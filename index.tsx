import React from 'react';
import ReactDOM from 'react-dom/client';
import { CallCenterTrainer } from './App';
import { EvaluationResult } from './types';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

/**
 * Handle the session completion.
 * This function sends the evaluation result back to the parent window/application.
 */
const handleSessionComplete = (result: EvaluationResult) => {
  console.log("Session Complete. Sending Data to Parent App:", result);

  // 1. Send to Parent Window (if hosted in an iframe)
  // The parent app can listen via window.addEventListener("message", ...)
  window.parent.postMessage({
    type: 'CALL_CENTER_EVALUATION_COMPLETE',
    payload: result
  }, "*");

  // 2. Example: If you wanted to send to a specific webhook/API directly:
  /*
  fetch('https://your-backend-api.com/save-evaluation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(result)
  }).catch(err => console.error("Failed to send to API", err));
  */
};

// Check if we have initial props passed via global variable (common for embedding)
const initialProps = (window as any).CALL_TRAINER_CONFIG || {};

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <CallCenterTrainer 
      onSessionComplete={handleSessionComplete}
      {...initialProps}
    />
  </React.StrictMode>
);