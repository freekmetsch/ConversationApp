import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Using Google Fonts loaded via CSS instead (see index.css)
createRoot(document.getElementById("root")!).render(<App />);
