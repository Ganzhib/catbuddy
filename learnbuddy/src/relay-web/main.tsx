import ReactDOM from "react-dom/client";
import "../globals.css";
import { RelayChatApp } from "./RelayChatApp";

const root = document.getElementById("root");
if (!root) throw new Error("root element missing");

ReactDOM.createRoot(root).render(<RelayChatApp />);
