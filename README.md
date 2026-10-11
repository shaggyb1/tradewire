# TradeWire

Live market news for Indian traders, straight from official sources: RBI, SEBI, PIB, NSE, BSE, the US Fed, ECB, Bank of England, Bank of Japan, US SEC and US EIA. Optional media feeds can be switched on in Settings.

Each headline is tagged High / Medium / Low impact with the sectors that usually react, plus a ▲ Bullish / ▼ Bearish / ◆ Mixed indicator explaining which way that kind of news typically moves Indian markets (e.g. "Rate cut → +Banks, NBFCs, Realty, Autos"). A news-mood gauge totals bullish vs bearish headlines over the last 24 hours.

All tags and indicators are keyword-based triage from headline wording. They are not investment advice or buy/sell signals.

## Versions

| Version | What's new |
|---|---|
| 1.3.0 | Bottom tabs (News · Insights · Options · Calendar · Settings). **Insights:** event-risk meter, 7-day mood trend, sector heatmap with NSE sector moves, watchlist news trend. **Options:** Nifty / Bank Nifty / Fin Nifty / Midcap Nifty option chain (PCR, max pain, call/put walls, OI build-up, ATM IV, implied move) and intraday indicators (EMA 9/21, RSI 14, Supertrend, opening range, day range) with a touch chart. Colour-blind-safe blue/red up/down colours |
| 1.2.0 | ★ Watchlist, 📅 market calendar (RBI, Fed, CPI/IIP/GDP, F&O expiries, holidays, watchlist results), app lock, hidden screen, NSE holiday-aware market status |
| 1.1.0 | Bullish / Bearish indicator, 24h news-mood gauge |
| 1.0.0 | First release: official feeds, impact tags, background alerts |

Every version's APK stays available on the [Releases](../../releases) page.

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

Screens are in `src/app/` (Expo Router tabs) and shared state in `src/store.tsx`. NSE market data (option chain, intraday prices, sector indices) is read in `src/nse.ts`; option-chain maths in `src/optionStats.ts`; intraday indicators in `src/indicators.ts`; insights in `src/insights.ts`. Feeds are listed in `src/sources.ts`, impact rules in `src/impact.ts`, bullish/bearish rules in `src/tone.ts`, background alerts in `src/alerts.ts`.
