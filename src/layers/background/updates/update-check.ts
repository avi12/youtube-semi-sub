import { isNewerVersion, parseLatestReleaseVersion } from "#background/updates/release-version";
import { browser } from "#imports";
import { LATEST_RELEASE_API_URL } from "@/lib/release";
import { updateAvailableVersionItem } from "@/lib/storage";

const UPDATE_CHECK_ALARM = "check-for-update";
const MINUTES_PER_DAY = 24 * 60;
const BADGE_TEXT = "!";
const BADGE_COLOR = "#cc0000";

async function fetchLatestVersion() {
  const response = await fetch(LATEST_RELEASE_API_URL, {
    headers: {
      Accept: "application/vnd.github+json"
    }
  });
  if (!response.ok) {
    return null;
  }

  return parseLatestReleaseVersion(await response.json());
}

async function applyAvailableUpdate(availableVersion: string | null) {
  const previousVersion = await updateAvailableVersionItem.getValue();
  if (availableVersion === previousVersion) {
    return;
  }

  await updateAvailableVersionItem.setValue(availableVersion);
  await browser.action.setBadgeBackgroundColor({ color: BADGE_COLOR });
  await browser.action.setBadgeText({ text: availableVersion ? BADGE_TEXT : "" });
}

async function checkForUpdate() {
  const latestVersion = await fetchLatestVersion();
  if (!latestVersion) {
    return;
  }

  const isUpdateAvailable = isNewerVersion({
    candidate: latestVersion,
    current: browser.runtime.getManifest().version
  });
  await applyAvailableUpdate(isUpdateAvailable ? latestVersion : null);
}

async function ensureUpdateCheckAlarm() {
  const alarm = await browser.alarms.get(UPDATE_CHECK_ALARM);
  if (alarm) {
    return;
  }

  await browser.alarms.create(UPDATE_CHECK_ALARM, { periodInMinutes: MINUTES_PER_DAY });
}

/**
 * Firefox applies self-hosted updates itself, so this is Chromium-only: there a zip or CRX loaded in Developer mode
 * never updates, and the popup points the user at the release page instead
 */
export function startUpdateCheck() {
  if (import.meta.env.FIREFOX) {
    return;
  }

  browser.alarms.onAlarm.addListener(({ name }) => {
    if (name === UPDATE_CHECK_ALARM) {
      checkForUpdate().catch(console.error);
    }
  });
  ensureUpdateCheckAlarm().catch(console.error);
  checkForUpdate().catch(console.error);
}
