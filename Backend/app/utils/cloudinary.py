import cloudinary
import cloudinary.uploader
import os

def init_cloudinary():
    cloudinary.config(
        cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
        api_key=os.getenv("CLOUDINARY_API_KEY"),
        api_secret=os.getenv("CLOUDINARY_API_SECRET"),
        secure=True
    )

def upload_image(file, folder="avatars"):
    """Upload file to Cloudinary and return public URL"""
    init_cloudinary()
    result = cloudinary.uploader.upload(file, folder=folder)
    return result["secure_url"]