import os
import re
import requests as req
from flask import Blueprint, request, jsonify

youtube_bp = Blueprint('youtube', __name__)

def _parse_iso8601_duration(duration: str) -> str:
    """Convert ISO 8601 duration (PT1H2M3S) to MM:SS or HH:MM:SS."""
    match = re.match(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?', duration)
    if not match:
        return ""
    h = int(match.group(1) or 0)
    m = int(match.group(2) or 0)
    s = int(match.group(3) or 0)
    if h:
        return f"{h}:{m:02d}:{s:02d}"
    return f"{m}:{s:02d}"


@youtube_bp.route('/youtube-search', methods=['GET'])
def youtube_search():
    """Search YouTube videos for learning content"""
    try:
        api_key = os.environ.get('YOUTUBE_API_KEY')
        if not api_key:
            return jsonify({'error': 'YouTube API not configured'}), 500

        q = request.args.get('q', '日本語').strip() or '日本語'
        lang = request.args.get('lang', 'ja')
        max_results = min(int(request.args.get('maxResults', 12)), 50)

        print(f"YouTube search: q={q}, maxResults={max_results}", flush=True)
        
        # Step 1: Search videos
        search_res = req.get(
            'https://www.googleapis.com/youtube/v3/search',
            params={
                'part': 'snippet',
                'q': q,
                'type': 'video',
                'relevanceLanguage': lang,
                'videoCaption': 'any',
                'maxResults': max_results,
                'key': api_key,
            },
            timeout=15
        )
        search_res.raise_for_status()
        search_data = search_res.json()

        items = search_data.get('items', [])
        if not items:
            print("No items found", flush=True)
            return jsonify({'videos': []})

        video_ids = [item['id']['videoId'] for item in items]
        print(f"Found {len(video_ids)} videos", flush=True)

        # Step 2: Get video details (duration, etc.)
        details_res = req.get(
            'https://www.googleapis.com/youtube/v3/videos',
            params={
                'part': 'contentDetails,snippet',
                'id': ','.join(video_ids),
                'key': api_key,
            },
            timeout=15
        )
        details_res.raise_for_status()
        details_data = details_res.json()

        details_map = {
            v['id']: v for v in details_data.get('items', [])
        }

        videos = []
        for item in items:
            vid_id = item['id']['videoId']
            snippet = item['snippet']
            detail = details_map.get(vid_id, {})
            content_details = detail.get('contentDetails', {})

            duration_raw = content_details.get('duration', '')
            duration_fmt = _parse_iso8601_duration(duration_raw)

            thumb = (
                snippet.get('thumbnails', {}).get('high', {}).get('url')
                or snippet.get('thumbnails', {}).get('medium', {}).get('url')
                or f"https://img.youtube.com/vi/{vid_id}/hqdefault.jpg"
            )

            videos.append({
                'id': vid_id,
                'title': snippet.get('title', ''),
                'channelTitle': snippet.get('channelTitle', ''),
                'thumbnail': thumb,
                'duration': duration_fmt,
                'publishedAt': snippet.get('publishedAt', ''),
            })

        print(f"Returning {len(videos)} videos", flush=True)
        return jsonify({'videos': videos}), 200

    except req.exceptions.Timeout:
        return jsonify({'error': 'YouTube API timeout'}), 504
    except req.exceptions.RequestException as e:
        print(f'YouTube API error: {e}', flush=True)
        return jsonify({'error': 'YouTube API error'}), 503
    except Exception as e:
        print(f'YouTube search error: {e}', flush=True)
        return jsonify({'error': str(e)}), 500
