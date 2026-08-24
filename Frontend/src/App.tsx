import { lazy, Suspense } from "react";
import { Route, BrowserRouter as Router, Routes } from "react-router";
import { ScrollToTop } from "./components/common/ScrollToTop";
import PageLoader from "./components/common/PageLoader";
import AppLayout from "./layout/AppLayout";
import AdminLayout from "./layout/AdminLayout";

const AdminHome = lazy(() => import("./pages/Admin/AdminHome"));
const AdminUserManagement = lazy(() => import("./pages/Admin/UserManagement"));
const AdminJLPTContentBank = lazy(() => import("./pages/Admin/JLPTContentBank"));
const AdminChatScenarios = lazy(() => import("./pages/Admin/ChatScenarios"));
const AdminVideoTranscripts = lazy(() => import("./pages/Admin/VideoTranscripts"));
const AdminSettings = lazy(() => import("./pages/Admin/Settings"));
const SignIn = lazy(() => import("./pages/AuthPages/SignIn"));
const SignUp = lazy(() => import("./pages/AuthPages/SignUp"));
const Calendar = lazy(() => import("./pages/Calendar"));
const ChatBot = lazy(() => import("./pages/Chatbot/ChatBot"));
const Vocabulary = lazy(() => import("./pages/Dictionary/Vocabulary"));
const FixGrammar = lazy(() => import("./pages/Grammar/FixGrammar"));
const MeetingLobby = lazy(() => import("./pages/Meeting/MeetingLobby"));
const MeetingRoom = lazy(() => import("./pages/Meeting/MeetingRoom"));
const NotFound = lazy(() => import("./pages/OtherPage/NotFound"));
const JLPTPracticePage = lazy(() => import("./pages/PracticeTest/TestPage"));
const CheckPronunciation = lazy(() => import("./pages/Pronunciation/CheckPronunciation"));
const UserProfiles = lazy(() => import("./pages/UserProfiles"));
const JapaneseWatch = lazy(() => import("./pages/VideoLearn/JapaneseWatch"));

export default function App() {
  return (
    <>
      <Router>
        <ScrollToTop />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Dashboard Layout */}
            <Route element={<AppLayout />}>
              <Route path="/dictionary" element={<Vocabulary />} />
              <Route index path="/" element={<Vocabulary />} />

              {/* Others Page */}
              <Route path="/fixgrammar" element={<FixGrammar />} />
              <Route path="/check-pronunciation" element={<CheckPronunciation />} />
              <Route path="/meeting" element={<MeetingLobby />} />
              <Route path="/profile" element={<UserProfiles />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/chat-bot" element={<ChatBot />} />
              <Route path="/jlpt-practice" element={<JLPTPracticePage />} />
              <Route path="/line-chart" element={<JapaneseWatch />} />
            </Route>
             <Route path="/meeting/room/:roomID" element={<MeetingRoom />} />

            {/* Admin */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminHome />} />
              <Route path="users" element={<AdminUserManagement />} />
              <Route path="jlpt-content" element={<AdminJLPTContentBank />} />
              <Route path="chat-scenarios" element={<AdminChatScenarios />} />
              <Route path="video-transcripts" element={<AdminVideoTranscripts />} />
              <Route path="settings" element={<AdminSettings />} />
            </Route>

            {/* Auth Layout */}
            <Route path="/signin" element={<SignIn />} />
            <Route path="/signup" element={<SignUp />} />

            {/* Fallback Route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </Router>
    </>
  );
}
