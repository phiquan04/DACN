import { lazy, Suspense } from "react";
import { Route, BrowserRouter as Router, Routes } from "react-router";
import { ScrollToTop } from "./components/common/ScrollToTop";
import PageLoader from "./components/common/PageLoader";
import AppLayout from "./layout/AppLayout";

const AdminHome = lazy(() => import("./pages/Admin/AdminHome"));
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
            <Route path="/admin" element={<AdminHome />} />

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
