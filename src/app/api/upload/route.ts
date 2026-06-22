import { NextRequest, NextResponse } from "next/server";
import {
  ingestAgentCSV,
  ingestDealsCSV,
  ingestCallsCSV,
  ingestTextsCSV,
  ingestAppointmentsCSV,
  combineFubExports,
  ingestJSON,
} from "@/lib/csv-ingest";
import { scoreAllAgents, buildLeaderboard } from "@/lib/scoring";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("files");

    if (files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    const fileContents: { name: string; text: string }[] = [];
    for (const file of files) {
      if (file instanceof File) {
        const text = await file.text();
        fileContents.push({ name: file.name, text });
      }
    }

    // Detect file types by name
    const dealFiles = fileContents.filter((f) => f.name.toLowerCase().includes("deal"));
    const callFiles = fileContents.filter((f) => f.name.toLowerCase().includes("call"));
    const textFiles = fileContents.filter((f) => f.name.toLowerCase().includes("text"));
    const apptFiles = fileContents.filter((f) =>
      f.name.toLowerCase().includes("appointment") || f.name.toLowerCase().includes("appt")
    );
    const jsonFiles = fileContents.filter((f) => f.name.endsWith(".json"));
    const genericCSVs = fileContents.filter(
      (f) =>
        f.name.endsWith(".csv") &&
        !dealFiles.includes(f) &&
        !callFiles.includes(f) &&
        !textFiles.includes(f) &&
        !apptFiles.includes(f)
    );

    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // If we have FUB-style exports, combine them
    if (dealFiles.length > 0 || callFiles.length > 0 || textFiles.length > 0 || apptFiles.length > 0) {
      const deals = dealFiles.length > 0 ? ingestDealsCSV(dealFiles[0].text, period) : new Map();
      const calls = callFiles.length > 0 ? ingestCallsCSV(callFiles[0].text) : new Map();
      const texts = textFiles.length > 0 ? ingestTextsCSV(textFiles[0].text) : new Map();
      const appts = apptFiles.length > 0 ? ingestAppointmentsCSV(apptFiles[0].text) : new Map();

      const agents = combineFubExports(deals, calls, texts, appts, period);
      const scored = scoreAllAgents(agents);
      const leaderboard = buildLeaderboard(agents);

      return NextResponse.json({
        success: true,
        source: "fub-exports",
        period,
        agentCount: agents.length,
        agents: scored,
        leaderboard,
      });
    }

    // JSON files
    if (jsonFiles.length > 0) {
      const result = ingestJSON(jsonFiles[0].text);
      const scored = scoreAllAgents(result.agents);
      const leaderboard = buildLeaderboard(result.agents);
      return NextResponse.json({
        success: true,
        source: "json",
        period: result.period,
        agentCount: result.agents.length,
        agents: scored,
        leaderboard,
        errors: result.errors,
      });
    }

    // Generic CSV
    if (genericCSVs.length > 0) {
      const result = ingestAgentCSV(genericCSVs[0].text);
      const scored = scoreAllAgents(result.agents);
      const leaderboard = buildLeaderboard(result.agents);
      return NextResponse.json({
        success: true,
        source: "csv",
        period: result.period,
        agentCount: result.agents.length,
        agents: scored,
        leaderboard,
        errors: result.errors,
      });
    }

    return NextResponse.json({ error: "No recognized file types" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: `Processing failed: ${error instanceof Error ? error.message : "Unknown error"}` },
      { status: 500 }
    );
  }
}
