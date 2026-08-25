import { useCallback, useState } from "react";
import {
  fetchImages,
  uploadImage as uploadImageApi,
  deleteImage as deleteImageApi,
  type DictionaryImageItem,
  type User,
} from "../../../services/api";

/** Community images attached to whichever word is currently being viewed. */
export function useWordImages(currentUser: User | null) {
  const [images, setImages] = useState<DictionaryImageItem[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const load = useCallback(async (word: string) => {
    if (!word) return;
    setLoadingImages(true);
    try {
      setImages(await fetchImages(word));
    } catch {
      setImages([]);
    } finally {
      setLoadingImages(false);
    }
  }, []);

  const reset = useCallback(() => setImages([]), []);

  const upload = useCallback(
    async (word: string, file: File) => {
      if (!currentUser || !word) return;
      setUploadingImage(true);
      try {
        const img = await uploadImageApi({ word, file });
        setImages((prev) => [img, ...prev]);
      } catch (err) {
        console.error("Failed to upload image:", err);
      } finally {
        setUploadingImage(false);
      }
    },
    [currentUser]
  );

  const remove = useCallback(
    async (image: DictionaryImageItem) => {
      if (!currentUser) return;
      try {
        await deleteImageApi(image.id);
        setImages((prev) => prev.filter((i) => i.id !== image.id));
      } catch {
        // silent
      }
    },
    [currentUser]
  );

  return { images, loadingImages, uploadingImage, load, reset, upload, remove };
}
