/**
 * Resolves after the browser has painted what was just rendered (two frames), so a spinner
 * shown right before heavy synchronous work is seen spinning. Falls back after `maxWait`
 * ms when frames do not fire (a background tab) or do not exist (tests).
 */
export function nextPaint(maxWait = 150): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, maxWait);

    if (typeof requestAnimationFrame !== "function") {
      return;
    }

    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        clearTimeout(timer);
        resolve();
      }),
    );
  });
}
