# Store listing text

What each field is for, how to write it, and the rules each store enforces. `scripts/listing.mjs` checks the limits; this file covers everything a counter cannot.

## Limits

| Store | Field | Limit | Searchable |
|---|---|---|---|
| App Store | Name | 30 | yes, strongest signal |
| App Store | Subtitle | 30 | yes |
| App Store | Promotional Text | 170 | no |
| App Store | Description | 4000 | no |
| App Store | Keywords | 100 | yes |
| Google Play | App name | 30 | yes |
| Google Play | Short description | 80 | yes |
| Google Play | Full description | 4000 | yes |

Never count characters by hand. Write the JSON, run the script, and shorten whatever it reports.

## App Store

**Name.** The brand, optionally followed by one or two keywords: `Monysa: Bütçe ve Harcama`. Use the name the app actually ships with (Android `android:label`, iOS `CFBundleDisplayName`, the `MaterialApp` title), not an invented one.

**Subtitle.** One benefit, in words that are not already in the name. Apple indexes the name, subtitle, and keywords together, so repeating a word wastes space.

**Promotional Text.** Shown above the description and editable at any time without a new app version. Use it for what is true right now: a new feature, a season, a price change. Avoid lines that go stale unnoticed.

**Description.** Not indexed for search, so write it for the person reading, not for ranking. Only the first two or three lines show before "more": put the main benefit there. Then short feature lines, grouped, benefit first. No keyword stuffing, no prices (they differ by country), no claims you cannot back up.

**Keywords.** Comma-separated with no spaces after the commas (a space costs one of the 100 characters). Use single words or short phrases the app is really about. Do not repeat words from the name or subtitle, the app's own category name, or "app". Never use competitor or trademarked names.

## Google Play

**App name.** Same rule as Apple: the real name, optionally plus a keyword. No emoji, no ALL CAPS, no "best", "#1", "free", or "new".

**Short description.** Shown on the listing and indexed for search. One sentence that says what the app does for the user.

**Full description.** Indexed for search, so use the terms people search for naturally, a few times, in real sentences. Google's metadata policy rejects keyword stuffing, repeated keyword lists, user testimonials, performance or ranking claims ("best", "#1", "top"), references to other apps, and anything misleading.

## Both stores

- Write in the listing's language, one JSON per language (`listing.json`, `listing-en.json`). Rewrite rather than translate literally.
- Describe only what the app does today. If a feature is on a screenshot, it can be in the text; if it is only planned, it cannot.
- Finance, health, and kids apps get stricter review. No promised savings or returns, no medical claims, no "safe for children" unless the app is built for them.
- Privacy statements ("your data stays on your phone") must match the code. If the app sends anything to a server, including analytics or crash reports, do not say it doesn't.

## App Store categories

Books, Business, Developer Tools, Education, Entertainment, Finance, Food & Drink, Games, Graphics & Design, Health & Fitness, Kids, Lifestyle, Magazines & Newspapers, Medical, Music, Navigation, News, Photo & Video, Productivity, Reference, Shopping, Social Networking, Sports, Travel, Utilities, Weather.

Pick the primary category from what the app mostly does. The secondary one is optional; use it when a second category honestly fits.

## App Store age rating

Apple works out the rating from a questionnaire in App Store Connect. The tiers are **4+, 9+, 13+, 16+, 18+**; the older 12+ and 17+ were retired in 2025. Answer every item and state the rating those answers should produce. The answers are the developer's declaration, so the user must confirm them in App Store Connect.

Use the answer options App Store Connect shows. The expected form is listed per item.

| Group | Item | Answer |
|---|---|---|
| In-App Controls | Parental Controls | Yes / No |
| In-App Controls | Age Assurance | Yes / No |
| Capabilities | Unrestricted Web Access | Yes / No |
| Capabilities | User-Generated Content | Yes / No |
| Capabilities | Social Media | Yes / No |
| Capabilities | Messaging and Chat | Yes / No |
| Capabilities | Advertising | Yes / No |
| Mature Themes | Profanity or Crude Humor | None / Infrequent / Frequent |
| Mature Themes | Horror/Fear Themes | None / Infrequent / Frequent |
| Mature Themes | Alcohol, Tobacco, or Drug Use or References | None / Infrequent / Frequent |
| Medical or Wellness | Medical or Treatment Information | None / Infrequent / Frequent |
| Medical or Wellness | Health or Wellness Topics | Yes / No |
| Sexuality or Nudity | Mature or Suggestive Themes | None / Infrequent / Frequent |
| Sexuality or Nudity | Sexual Content or Nudity | None / Infrequent / Frequent |
| Sexuality or Nudity | Graphic Sexual Content and Nudity | None / Infrequent / Frequent |
| Violence | Cartoon or Fantasy Violence | None / Infrequent / Frequent |
| Violence | Realistic Violence | None / Infrequent / Frequent |
| Violence | Prolonged Graphic or Sadistic Realistic Violence | None / Infrequent / Frequent |
| Violence | Guns or Other Weapons | None / Infrequent / Frequent |
| Chance-Based Activities | Gambling | Yes / No |
| Chance-Based Activities | Simulated Gambling | None / Infrequent / Frequent |
| Chance-Based Activities | Contests | None / Infrequent / Frequent |
| Chance-Based Activities | Loot Boxes | Yes / No |

"Social Media Disabled for Users Under 13" only appears when Social Media is Yes.

**Answer from evidence, not assumption.** Read the dependencies (`pubspec.yaml`, `package.json`, `build.gradle`, `Podfile`) and grep the code:

- Ad SDKs (`google_mobile_ads`, AdMob, AppLovin, Unity Ads, Meta Audience Network) → Advertising: Yes.
- A web view or in-app browser that can open any URL (`webview_flutter`, `WKWebView`, `WebView`) → Unrestricted Web Access: Yes. A fixed page such as your privacy policy does not count.
- Chat, comments, profiles, uploads, or posts seen by other users → Messaging and Chat and/or User-Generated Content: Yes.
- Real-money betting → Gambling: Yes. Casino-style mechanics without money → Simulated Gambling.

If the code cannot settle an item, ask the user rather than guess. Apple rejects apps whose answers do not match what the app does.

## Identifiers and the App ID registration

Every listing carries the identifiers the consoles ask for before anything else. Read them from the
project, never invent them, and tell the user that both are permanent once a build is uploaded.

- **Google Play package name** (`google.package`): `applicationId` in `android/app/build.gradle(.kts)`
  — not `namespace`, which can differ.
- **App Store bundle ID** (`apple.app_id.bundle_id`): `PRODUCT_BUNDLE_IDENTIFIER` of the app
  target's Release configuration in `ios/Runner.xcodeproj/project.pbxproj` (not the tests target).
  Register it as **Explicit**.
- **App ID description** (`apple.app_id.description`): the app's name; Apple rejects `@ & * "`.

**Capabilities** — tick only what the project proves it uses, and give each one its evidence in
`why`:

| Evidence in the project | Capability |
|---|---|
| `com.apple.developer.applesignin` in `*.entitlements`, or `sign_in_with_apple` | Sign In with Apple |
| `aps-environment` entitlement, `firebase_messaging`, or other remote push | Push Notifications |
| `in_app_purchase`, `purchases_flutter` (RevenueCat), StoreKit | In-App Purchase |
| `com.apple.developer.associated-domains`, universal links | Associated Domains |
| `com.apple.security.application-groups`, widgets or extensions sharing data | App Groups |
| iCloud / CloudKit entitlements | iCloud |
| HealthKit entitlement or a health package | HealthKit |
| Apple Pay merchant IDs, a pay package | Apple Pay Payment Processing |
| `com.apple.developer.nfc.readersession.formats` | NFC Tag Reading |
| Time-sensitive notification entitlement | Time Sensitive Notifications |

Needing **no** capability: local notifications only (`flutter_local_notifications`), Google Sign-In
(a URL scheme in `Info.plist`), background modes other than remote notifications, camera, photos,
microphone and speech (those are `Info.plist` usage strings, not capabilities).

**App Services** — only for Apple services the code calls: WeatherKit, MusicKit, ShazamKit. Usually
none.

**Capability Requests** — entitlements Apple grants only on request (for example CarPlay, Critical
Alerts, Family Controls for distribution). List one only when the project's entitlements already
use it, and tell the user to file the request before submission.

Tell the user which capabilities to double-check in the portal, especially anything inferred from a
package rather than read from an entitlements file.
