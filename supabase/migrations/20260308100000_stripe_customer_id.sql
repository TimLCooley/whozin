-- Add stripe_customer_id to whozin_users for Stripe webhook subscription tracking
ALTER TABLE whozin_users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
CREATE INDEX IF NOT EXISTS idx_whozin_users_stripe_customer_id ON whozin_users(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
