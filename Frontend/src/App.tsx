import { Route, BrowserRouter as Router, Routes } from "react-router";
import { ScrollToTop } from "./components/common/ScrollToTop";
import AppLayout from "./layout/AppLayout";
import AdminHome from "./pages/Admin/AdminHome";
import SignIn from "./pages/AuthPages/SignIn";
import SignUp from "./pages/AuthPages/SignUp";
import Calendar from "./pages/Calendar";
import ChatBot from "./pages/Chatbot/ChatBot";
import Vocabulary from "./pages/Dictionary/Vocabulary";
import FixGrammar from "./pages/Grammar/FixGrammar";
import MeetingLobby from "./pages/Meeting/MeetingLobby";
import MeetingRoom from "./pages/Meeting/MeetingRoom";
import NotFound from "./pages/OtherPage/NotFound";
import JLPTPracticePage from "./pages/PracticeTest/TestPage";
import CheckPronunciation from "./pages/Pronunciation/CheckPronunciation";
import UserProfiles from "./pages/UserProfiles";
import JapaneseWatch from "./pages/VideoLearn/JapaneseWatch";


export default function App() {
  return (
    <>
      <Router>
        <ScrollToTop />
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
      </Router>
    </>
  );
}
