async function dismissFirstRunOnboarding(page) {
  const skipButton = page.getByRole("button", { name: "跳过引导", exact: true });
  if (await skipButton.count()) {
    await skipButton.click();
    await page.locator(".first-run-onboarding").waitFor({ state: "detached" });
  }
}

module.exports = { dismissFirstRunOnboarding };
