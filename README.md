# TradeWire

Live market news for Indian traders, straight from official sources: RBI, SEBI, PIB, NSE, BSE, the US Fed, ECB, Bank of England, Bank of Japan, US SEC and US EIA. Optional media feeds can be switched on in Settings.

Each headline is tagged High / Medium / Low impact with the sectors that usually react. Tags are keyword-based triage, not investment advice.

## Install (Android)

1. Download the latest `TradeWire-*.apk` from [Releases](../../releases).
2. Open it on your phone and allow installs from this source when Android asks.
3. Open **TradeWire**.

## Privacy

No account, analytics, ads or backend server. The phone fetches each feed directly from the official site over HTTPS, and all data stays on the device. Sites you fetch from can still see your IP address; use a VPN or Orbot if you need to hide it.

## Develop

```bash
npm install
npx expo start
```

Build a new APK with `npx eas-cli build -p android --profile preview`.

Feeds are listed in `src/sources.ts`, impact rules in `src/impact.ts`, background alerts in `src/alerts.ts`.
