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

## Permissions

Both store sections carry a `permissions` list (`[]` when the app needs none), each entry with the
evidence in `why`. Read them from what the build actually requests, never from what the app might
need.

**App Store** (`apple.permissions`) — every `NS…UsageDescription` key the app needs in
`Info.plist`, with the purpose `text` the user sees in the system prompt. Find them in
`ios/Runner/Info.plist` and in the plugins: `image_picker` → camera and photo library,
`permission_handler`, `geolocator` → location, `record` → microphone, `local_auth` → Face ID,
`contacts_service`, `app_tracking_transparency` → `NSUserTrackingUsageDescription`. A key the code
needs but `Info.plist` lacks crashes the app on first use and gets the build rejected (ITMS-90683),
so flag any gap as a fix to make in the project. Write the purpose text in the app's language, say
concretely what the data is for ("Scan receipts to add expenses", not "The app needs the camera"):
Apple rejects vague purpose strings under Guideline 5.1.1.

**Google Play** (`google.permissions`) — every `<uses-permission>` in the **merged** release
manifest, since plugins add their own: `build/app/intermediates/merged_manifests/release/` after a
release build, or `aapt dump permissions app-release.apk`. Leave out normal install-time
permissions the user never sees (`INTERNET`, `ACCESS_NETWORK_STATE`, `VIBRATE`, `WAKE_LOCK`) only
when the list gets long, never a dangerous or special one. Set `declaration` for those that need a
Play Console form before review:

| Permission | Play Console declaration |
|---|---|
| `ACCESS_BACKGROUND_LOCATION` | Location permissions declaration + video |
| `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO` | Photo and video permissions (use the photo picker instead when access is one-off) |
| `READ_SMS`, `SEND_SMS`, `READ_CALL_LOG` and other SMS / Call Log | Permissions declaration form; default handler only |
| `MANAGE_EXTERNAL_STORAGE` | All files access declaration |
| `QUERY_ALL_PACKAGES` | Package visibility declaration |
| `USE_EXACT_ALARM`, `SCHEDULE_EXACT_ALARM` | Exact alarm declaration (alarm or calendar apps only) |
| `FOREGROUND_SERVICE_*` (Android 14+) | Foreground service types declaration + video |
| `BIND_ACCESSIBILITY_SERVICE` | Accessibility API declaration |
| `REQUEST_INSTALL_PACKAGES` | Request install packages declaration |

A permission no feature uses, often pulled in by a plugin, is better removed from the manifest
(`tools:node="remove"`) than declared; say so to the user.

## App Store submission blockers

App Store Connect will not submit a build until each of these is filled in. `listing.mjs` refuses
an `apple` section that lacks one, so the listing documents always cover all of them:

| Console message | Where | Listing key |
|---|---|---|
| You must select a primary category | App Information → Category | `category.primary` |
| You must enter a Privacy Policy URL | App Privacy → Privacy Policy | `privacy_policy_url` |
| An Admin must provide information about the app's privacy practices | App Privacy → Get Started | `app_privacy` |
| You must choose a price tier | Pricing and Availability | `price` |
| You must upload a screenshot for 13-inch iPad displays | version page → iPad 13" | `apple/ipad` render target |

**Privacy policy URL.** The public `https://` page from **Privacy policy page** in `SKILL.md`. Until
it is live, write the URL it will have (`https://<owner>.github.io/<repo>/`) and tell the user it
must be reachable before review.

**Price.** `"Free"`, or the base price in the base country's currency (`"USD 2.99"`). The project
can't tell you this; ask. In-app purchases and subscriptions are set up separately and do not change
the app's own price.

## App Privacy

The "nutrition label" on the product page. Answer it from every SDK and backend that sees user data,
the same evidence as the privacy policy, and the two must agree. Data that only stays on the device
is not "collected"; data sent off the device is, even when you never look at it.

`app_privacy` in the listing:

```json
"app_privacy": {
  "tracking": false,
  "data": [
    { "type": "Email Address", "purposes": ["App Functionality"], "linked": true,
      "tracking": false, "why": "supabase_flutter auth" }
  ]
}
```

`"data": []` means **Data Not Collected**. `tracking: true` (data linked with other companies' data
for ads, or shared with a data broker) also requires the App Tracking Transparency prompt and
`NSUserTrackingUsageDescription`.

Data types, by group: **Contact Info** — Name, Email Address, Phone Number, Physical Address, Other
User Contact Info. **Health & Fitness** — Health, Fitness. **Financial Info** — Payment Info, Credit
Info, Other Financial Info. **Location** — Precise Location, Coarse Location. **Sensitive Info**.
**Contacts**. **User Content** — Emails or Text Messages, Photos or Videos, Audio Data, Gameplay
Content, Customer Support, Other User Content. **Browsing History**. **Search History**.
**Identifiers** — User ID, Device ID. **Purchases** — Purchase History. **Usage Data** — Product
Interaction, Advertising Data, Other Usage Data. **Diagnostics** — Crash Data, Performance Data,
Other Diagnostic Data. **Other Data**.

Purposes: Third-Party Advertising, Developer's Advertising or Marketing, Analytics, Product
Personalization, App Functionality, Other Purposes.

Common SDK evidence: Firebase Analytics → Product Interaction, Device ID (Analytics); Crashlytics or
Sentry → Crash Data, Performance Data (App Functionality); Supabase or Firebase Auth → Email
Address, User ID (App Functionality, linked); ads SDKs (AdMob) → Advertising Data, Device ID
(Third-Party Advertising, usually tracking); RevenueCat or StoreKit receipts sent to a server →
Purchase History. A user's own records synced to your backend (expenses, notes) → Other User
Content or Other Financial Info, linked.

The answers are the developer's declaration and only an Admin can publish them: tell the user which
ones to confirm in App Store Connect.
