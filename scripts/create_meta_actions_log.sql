-- Meta Ads Actions Log — audit trail of all write operations on Meta Ads entities
-- (pause/resume/budget changes) performed via Cortex, whether by human admins or
-- the "Gestor de Performance" AI agent (supervised, V1).
--
-- Location: cortex_core schema (internal Cortex table — not data synced from Meta).
-- Follows db-specialist.md rule: new internal tables go to cortex_core.

CREATE SCHEMA IF NOT EXISTS cortex_core;

CREATE TABLE IF NOT EXISTS cortex_core.meta_actions_log (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Who initiated the action
    actor_type VARCHAR(16) NOT NULL,          -- 'human' | 'agent'
    actor_user_id VARCHAR(64),                -- auth_users.id of the admin (confirmer or manual actor)
    actor_email VARCHAR(255),

    -- Target entity on Meta Ads
    level VARCHAR(16) NOT NULL,               -- 'ad' | 'adset' | 'campaign'
    entity_id VARCHAR(64) NOT NULL,           -- Meta entity id (ad_id / adset_id / campaign_id)
    entity_name TEXT,                         -- Snapshot of name at action time

    -- Action details
    action VARCHAR(32) NOT NULL,              -- 'pause' | 'resume' | 'budget_update'
    payload_json JSONB NOT NULL,              -- New values we are pushing to Meta
    previous_value_json JSONB,                -- Snapshot of value before the change (for rollback/audit)
    reason TEXT NOT NULL,                     -- Required justification (>= 5 chars) supplied by admin / agent
    agent_rationale_text TEXT,                -- Agent's natural-language rationale when actor_type='agent'

    -- Execution lifecycle (used for optimistic locking)
    status VARCHAR(16) NOT NULL DEFAULT 'pending',   -- 'pending' | 'executing' | 'success' | 'error' | 'ignored'
    meta_error_json JSONB,                    -- Sanitized error payload from Meta (no access_token)

    -- Confirmation audit (when an agent proposal is approved by a human admin)
    confirmed_by_user_id VARCHAR(64),
    confirmed_at TIMESTAMPTZ
);

-- Lookup by entity + status (history tab, "already has pending proposal?" check)
CREATE INDEX IF NOT EXISTS idx_meta_actions_log_entity
    ON cortex_core.meta_actions_log(entity_id, status);

-- Fast scan of pending agent proposals for the approval drawer
CREATE INDEX IF NOT EXISTS idx_meta_actions_log_pending
    ON cortex_core.meta_actions_log(status)
    WHERE status = 'pending';

COMMENT ON TABLE  cortex_core.meta_actions_log IS 'Audit trail of Meta Ads write operations (pause/resume/budget) via Cortex. Used for history, optimistic locking, and rollback.';
COMMENT ON COLUMN cortex_core.meta_actions_log.actor_type IS 'human = admin did it directly; agent = AI agent proposed it (requires human confirmation to execute)';
COMMENT ON COLUMN cortex_core.meta_actions_log.status IS 'pending = awaiting admin approval; executing = admin clicked confirm, Meta call in flight; success/error = final state; ignored = admin dismissed without executing';
COMMENT ON COLUMN cortex_core.meta_actions_log.previous_value_json IS 'Snapshot captured before calling Meta (e.g. old effective_status or old daily_budget) — used for rollback and auditing';
COMMENT ON COLUMN cortex_core.meta_actions_log.meta_error_json IS 'Sanitized Meta API error (access_token stripped) when status=error';
