import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getStoredUser, getUserProfile, type UserProfile } from "../../../services/api";

/** Loads the current user's profile for the lobby card, and builds the room URL to open when starting/joining a meeting. */
export function useMeetingLobby() {
  const navigate = useNavigate();
  const [roomID, setRoomID] = useState("");
  const [mode, setMode] = useState<"create" | "join">("create");
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      const storedUser = getStoredUser();
      if (!storedUser) {
        alert("Vui lòng đăng nhập để sử dụng tính năng họp trực tuyến");
        navigate("/signin");
        return;
      }
      try {
        const profile = await getUserProfile();
        setUserProfile(profile);
      } catch (error) {
        console.error("Failed to load profile", error);
        // Fallback: dùng thông tin từ storedUser
        setUserProfile({
          email: storedUser.email,
          username: storedUser.username,
        });
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, [navigate]);

  const getFullName = (): string => {
    if (!userProfile) return "Người dùng";
    const firstName = userProfile.first_name || "";
    const lastName = userProfile.last_name || "";
    const fullName = `${firstName} ${lastName}`.trim();
    return fullName || userProfile.username;
  };

  const handleStart = () => {
    if (!userProfile) {
      alert("Chưa có thông tin người dùng");
      return;
    }

    const finalRoomID =
      mode === "create"
        ? Math.random().toString(36).substring(2, 9).toUpperCase()
        : roomID.trim().toUpperCase();

    if (!finalRoomID) {
      alert("Vui lòng nhập mã phòng!");
      return;
    }

    const fullName = getFullName();
    const avatarUrl = userProfile.avatar_url || "";

    // Mở tab mới với URL bao gồm roomID, userName và avatarUrl
    const url = `/meeting/room/${finalRoomID}?userName=${encodeURIComponent(fullName)}&avatarUrl=${encodeURIComponent(avatarUrl)}`;
    window.open(url, "_blank");
  };

  return { roomID, setRoomID, mode, setMode, userProfile, loading, getFullName, handleStart };
}
