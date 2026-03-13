export async function captureScreenshot(): Promise<string> {
  const dataUrl = await chrome.tabs.captureVisibleTab({ format: 'png' });
  return dataUrl;
}
