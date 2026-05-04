-- Pricing config stored as a single JSON blob in whozin_settings.
-- Source of truth for displayed prices on web + native, and for Stripe checkout
-- price IDs. Apple/Google product IDs are display-only — actual store prices
-- must still be set in App Store Connect / Google Play Console.

insert into whozin_settings (key, value) values (
  'pricing_plans',
  '{
    "currency": "USD",
    "plans": [
      {
        "id": "monthly",
        "label": "Monthly",
        "amount_cents": 1299,
        "display_price": "$12.99",
        "subtext": "/month",
        "badge": "",
        "billing_period": "month",
        "is_subscription": true,
        "stripe_product_id": "",
        "stripe_price_id": "",
        "apple_product_id": "whozin_pro_monthly",
        "google_product_id": "whozin_pro_monthly",
        "enabled": true
      },
      {
        "id": "annual",
        "label": "Annual",
        "amount_cents": 9999,
        "display_price": "$99.99",
        "subtext": "/year",
        "badge": "Save 36%",
        "billing_period": "year",
        "is_subscription": true,
        "stripe_product_id": "",
        "stripe_price_id": "",
        "apple_product_id": "whozin_pro_annual",
        "google_product_id": "whozin_pro_annual",
        "enabled": true
      },
      {
        "id": "lifetime",
        "label": "Lifetime",
        "amount_cents": 19999,
        "display_price": "$199.99",
        "subtext": "one-time",
        "badge": "",
        "billing_period": "lifetime",
        "is_subscription": false,
        "stripe_product_id": "",
        "stripe_price_id": "",
        "apple_product_id": "whozin_pro_lifetime",
        "google_product_id": "whozin_pro_lifetime",
        "enabled": true
      }
    ]
  }'::jsonb
)
on conflict (key) do nothing;
