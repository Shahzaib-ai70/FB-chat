import { Route, Routes } from "react-router-dom";
import { AgentConsolePage } from "./pages/AgentConsolePage";
import { CustomerChatPage } from "./pages/CustomerChatPage";

export default function App() {
  return (
    <div className="app-shell">
      <main>
        <Routes>
          <Route element={<CustomerChatPage />} path="/" />
          <Route element={<AgentConsolePage />} path="/agent" />
        </Routes>
      </main>
    </div>
  );
}
