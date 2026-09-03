import os
import re
import requests as req
from fastapi import APIRouter, HTTPException
from typing import Optional

router = APIRouter()

def _parse_iso8601_duration(duration: str) -> str:
    match = re.match(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?', duration)
    if not match:
        return ""
    h = int(match.group(1) or 0)
    m = int(match.group(2) or 0)
    s = int(match.group(3) or 0)
    if h:
        return f"{h}:{m:02d}:{s:02d}"
    return f"{m}:{s:02d}"


def _fetch_video_details(video_ids: list, api_key: str) -> dict:
    """videos.list(contentDetails,snippet) for a batch of ids, keyed by video id."""
    if not video_ids:
        return {}
    res = req.get(
        'https://www.googleapis.com/youtube/v3/videos',
        params={
            'part': 'contentDetails,snippet',
            'id': ','.join(video_ids),
            'key': api_key,
        },
        timeout=15
    )
    res.raise_for_status()
    return {v['id']: v for v in res.json().get('items', [])}


def _format_video(vid_id: str, snippet: dict, details_map: dict) -> dict:
    detail = details_map.get(vid_id, {})
    content_details = detail.get('contentDetails', {})
    duration_fmt = _parse_iso8601_duration(content_details.get('duration', ''))
    thumb = (
        snippet.get('thumbnails', {}).get('high', {}).get('url')
        or snippet.get('thumbnails', {}).get('medium', {}).get('url')
        or f"https://img.youtube.com/vi/{vid_id}/hqdefault.jpg"
    )
    return {
        'id': vid_id,
        'title': snippet.get('title', ''),
        'channelId': snippet.get('channelId', ''),
        'channelTitle': snippet.get('channelTitle', ''),
        'thumbnail': thumb,
        'duration': duration_fmt,
        'publishedAt': snippet.get('publishedAt', ''),
    }


@router.get('/youtube-search')
def youtube_search(q: str = "日本語", lang: str = "ja", maxResults: int = 12):
    try:
        api_key = os.environ.get('YOUTUBE_API_KEY')
        if not api_key:
            raise HTTPException(status_code=500, detail='YouTube API not configured')

        q = q.strip() or '日本語'
        maxResults = min(maxResults, 50)

        print(f"YouTube search: q={q}, maxResults={maxResults}", flush=True)
        
        # Step 1: Search videos
        search_res = req.get(
            'https://www.googleapis.com/youtube/v3/search',
            params={
                'part': 'snippet',
                'q': q,
                'type': 'video',
                'relevanceLanguage': lang,
                'videoCaption': 'any',
                'maxResults': maxResults,
                'key': api_key,
            },
            timeout=15
        )
        search_res.raise_for_status()
        search_data = search_res.json()

        items = search_data.get('items', [])
        if not items:
            print("No items found", flush=True)
            return {'videos': []}

        video_ids = [item['id']['videoId'] for item in items]
        print(f"Found {len(video_ids)} videos", flush=True)

        # Step 2: Get video details (duration, etc.)
        details_map = _fetch_video_details(video_ids, api_key)

        videos = [
            _format_video(item['id']['videoId'], item['snippet'], details_map)
            for item in items
        ]

        print(f"Returning {len(videos)} videos", flush=True)
        return {'videos': videos}

    except req.exceptions.Timeout:
        raise HTTPException(status_code=504, detail='YouTube API timeout')
    except req.exceptions.RequestException as e:
        print(f'YouTube API error: {e}', flush=True)
        raise HTTPException(status_code=503, detail='YouTube API error')
    except Exception as e:
        print(f'YouTube search error: {e}', flush=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/youtube-related')
def youtube_related(
    videoId: str,
    channelId: Optional[str] = None,
    title: Optional[str] = None,
    maxResults: int = 12,
):
    """Video 'đề xuất' cho videoId đang xem.

    YouTube Data API v3 đã bỏ tham số relatedToVideoId (8/2023) nên không còn
    cách chính thức lấy đúng danh sách "related" của YouTube. Thay vào đó kết
    hợp: (1) video khác cùng kênh (mới nhất trước), rồi (2) nếu chưa đủ, bổ
    sung bằng search theo tiêu đề video hiện tại.
    """
    try:
        api_key = os.environ.get('YOUTUBE_API_KEY')
        if not api_key:
            raise HTTPException(status_code=500, detail='YouTube API not configured')

        maxResults = min(max(maxResults, 1), 30)

        # Need channelId/title if caller didn't already have them (e.g. deep link)
        if not channelId or not title:
            snippet_res = req.get(
                'https://www.googleapis.com/youtube/v3/videos',
                params={'part': 'snippet', 'id': videoId, 'key': api_key},
                timeout=15
            )
            snippet_res.raise_for_status()
            snippet_items = snippet_res.json().get('items', [])
            if snippet_items:
                base_snippet = snippet_items[0]['snippet']
                channelId = channelId or base_snippet.get('channelId')
                title = title or base_snippet.get('title')

        seen_ids: set = {videoId}
        ordered_items = []  # list of (video_id, snippet)

        # Step 1: other videos from the same channel
        if channelId:
            same_channel_res = req.get(
                'https://www.googleapis.com/youtube/v3/search',
                params={
                    'part': 'snippet',
                    'channelId': channelId,
                    'type': 'video',
                    'order': 'date',
                    'maxResults': maxResults + 1,
                    'key': api_key,
                },
                timeout=15
            )
            same_channel_res.raise_for_status()
            for item in same_channel_res.json().get('items', []):
                vid_id = item['id']['videoId']
                if vid_id not in seen_ids:
                    seen_ids.add(vid_id)
                    ordered_items.append((vid_id, item['snippet']))

        # Step 2: fill remaining slots with a title-based search
        remaining = maxResults - len(ordered_items)
        if remaining > 0 and title:
            title_res = req.get(
                'https://www.googleapis.com/youtube/v3/search',
                params={
                    'part': 'snippet',
                    'q': title,
                    'type': 'video',
                    'relevanceLanguage': 'ja',
                    'maxResults': remaining + len(seen_ids),
                    'key': api_key,
                },
                timeout=15
            )
            title_res.raise_for_status()
            for item in title_res.json().get('items', []):
                vid_id = item['id']['videoId']
                if vid_id not in seen_ids:
                    seen_ids.add(vid_id)
                    ordered_items.append((vid_id, item['snippet']))
                if len(ordered_items) >= maxResults:
                    break

        ordered_items = ordered_items[:maxResults]
        details_map = _fetch_video_details([vid_id for vid_id, _ in ordered_items], api_key)
        videos = [_format_video(vid_id, snippet, details_map) for vid_id, snippet in ordered_items]

        return {'videos': videos}

    except req.exceptions.Timeout:
        raise HTTPException(status_code=504, detail='YouTube API timeout')
    except req.exceptions.RequestException as e:
        print(f'YouTube related API error: {e}', flush=True)
        raise HTTPException(status_code=503, detail='YouTube API error')
    except Exception as e:
        print(f'YouTube related error: {e}', flush=True)
        raise HTTPException(status_code=500, detail=str(e))
