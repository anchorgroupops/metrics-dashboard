-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "agents" (
    "id" TEXT NOT NULL,
    "fub_id" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'agent',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "team_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crew_leads" (
    "id" TEXT NOT NULL,
    "fub_id" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "agent_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crew_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zillow_metrics" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "pcvr" DOUBLE PRECISION,
    "pickup_rate" DOUBLE PRECISION,
    "zhl_preapproval" DOUBLE PRECISION,
    "csat" DOUBLE PRECISION,
    "connections" INTEGER,
    "leads" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'zillow_scraper',
    "raw" JSONB,
    "scraped_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "zillow_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fub_metrics" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "calls" INTEGER NOT NULL DEFAULT 0,
    "texts" INTEGER NOT NULL DEFAULT 0,
    "appointments" INTEGER NOT NULL DEFAULT 0,
    "deals" INTEGER NOT NULL DEFAULT 0,
    "nurture_tasks" INTEGER NOT NULL DEFAULT 0,
    "zillow_leads" INTEGER NOT NULL DEFAULT 0,
    "raw" JSONB,
    "pulled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fub_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_snapshots" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "snapshot_date" TEXT NOT NULL,
    "operational_readiness" DOUBLE PRECISION,
    "overall_status" TEXT,
    "leaderboard_points" INTEGER NOT NULL DEFAULT 0,
    "zilpi_eligible" BOOLEAN NOT NULL DEFAULT false,
    "fub_metric_id" TEXT,
    "zillow_metric_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "performance_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_periods" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "metric_key" TEXT NOT NULL,
    "value" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_snapshots" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "snapshot_date" TEXT NOT NULL,
    "metric_key" TEXT NOT NULL,
    "value" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "runs" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "period" TEXT,
    "status" TEXT NOT NULL DEFAULT 'running',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "error" TEXT,
    "meta" JSONB,

    CONSTRAINT "runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drafts" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "html_body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "sent_at" TIMESTAMP(3),

    CONSTRAINT "drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agents_fub_id_key" ON "agents"("fub_id");

-- CreateIndex
CREATE UNIQUE INDEX "agents_email_key" ON "agents"("email");

-- CreateIndex
CREATE INDEX "agents_team_id_idx" ON "agents"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "teams_slug_key" ON "teams"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "crew_leads_fub_id_key" ON "crew_leads"("fub_id");

-- CreateIndex
CREATE UNIQUE INDEX "crew_leads_email_key" ON "crew_leads"("email");

-- CreateIndex
CREATE UNIQUE INDEX "crew_leads_team_id_key" ON "crew_leads"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "crew_leads_agent_id_key" ON "crew_leads"("agent_id");

-- CreateIndex
CREATE INDEX "zillow_metrics_period_idx" ON "zillow_metrics"("period");

-- CreateIndex
CREATE UNIQUE INDEX "zillow_metrics_agent_id_period_key" ON "zillow_metrics"("agent_id", "period");

-- CreateIndex
CREATE INDEX "fub_metrics_period_idx" ON "fub_metrics"("period");

-- CreateIndex
CREATE UNIQUE INDEX "fub_metrics_agent_id_period_key" ON "fub_metrics"("agent_id", "period");

-- CreateIndex
CREATE INDEX "performance_snapshots_period_idx" ON "performance_snapshots"("period");

-- CreateIndex
CREATE INDEX "performance_snapshots_snapshot_date_idx" ON "performance_snapshots"("snapshot_date");

-- CreateIndex
CREATE UNIQUE INDEX "performance_snapshots_agent_id_snapshot_date_key" ON "performance_snapshots"("agent_id", "snapshot_date");

-- CreateIndex
CREATE INDEX "agent_periods_period_idx" ON "agent_periods"("period");

-- CreateIndex
CREATE INDEX "agent_periods_agent_id_period_idx" ON "agent_periods"("agent_id", "period");

-- CreateIndex
CREATE UNIQUE INDEX "agent_periods_agent_id_period_metric_key_key" ON "agent_periods"("agent_id", "period", "metric_key");

-- CreateIndex
CREATE INDEX "daily_snapshots_snapshot_date_idx" ON "daily_snapshots"("snapshot_date");

-- CreateIndex
CREATE INDEX "daily_snapshots_agent_id_snapshot_date_idx" ON "daily_snapshots"("agent_id", "snapshot_date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_snapshots_agent_id_snapshot_date_metric_key_key" ON "daily_snapshots"("agent_id", "snapshot_date", "metric_key");

-- CreateIndex
CREATE INDEX "runs_status_idx" ON "runs"("status");

-- CreateIndex
CREATE INDEX "drafts_status_idx" ON "drafts"("status");

-- CreateIndex
CREATE INDEX "drafts_period_idx" ON "drafts"("period");

-- CreateIndex
CREATE UNIQUE INDEX "drafts_agent_id_period_key" ON "drafts"("agent_id", "period");

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crew_leads" ADD CONSTRAINT "crew_leads_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zillow_metrics" ADD CONSTRAINT "zillow_metrics_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fub_metrics" ADD CONSTRAINT "fub_metrics_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_snapshots" ADD CONSTRAINT "performance_snapshots_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_periods" ADD CONSTRAINT "agent_periods_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_snapshots" ADD CONSTRAINT "daily_snapshots_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

