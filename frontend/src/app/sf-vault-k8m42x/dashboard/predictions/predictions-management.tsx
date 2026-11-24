"use client";

import { apiFetch } from "@/lib/api";


import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";

type SportOption = {
  id: number;
  name: string;
  slug: string;
};

type TeamOption = {
  id: number;
  name: string;
  sportId: number;
  isActive: boolean;
};

type Match = {
  id: number;
  competition: string | null;
  venue: string | null;
  imageUrl: string | null;
  status: string;
  predictionsClosedAt: string | null;
  predictionClosesAt: string | null;
  scheduledAt: string;
  startedAt: string | null;
  endedAt: string | null;
  homeScore: number | null;
  awayScore: number | null;
  sport: { id: number; name: string } | null;
  homeTeam: {
    id: number;
    name: string;
    shortName: string | null;
    logoUrl: string | null;
  } | null;
  awayTeam: {
    id: number;
    name: string;
    shortName: string | null;
    logoUrl: string | null;
  } | null;
  predictionCount: number;
  openPredictions: number;
  resolvedPredictions: number;
};

type FanPrediction = {
  id: number;
  userId: number;
  matchId: number;
  homeScore: number;
  awayScore: number;
  pointsAwarded: number;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
  fan: { id: number; name: string };
  match: {
    id: number;
    competition: string | null;
    status: string;
    scheduledAt: string;
    homeScore: number;
    awayScore: number;
    homeTeam: string;
    awayTeam: string;
  } | null;
};

type Summary = {
  totalMatches: number;
  totalPredictions: number;
  openPredictions: number;
  wonPredictions: number;
  lostPredictions: number;
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 13px",
  borderRadius: 10,
  border: "1px solid #303447",
  background: "#10121b",
  color: "#f5f6fa",
  outline: "none",
  fontSize: 14,
  boxSizing: "border-box",
};

const buttonStyle: React.CSSProperties = {
  border: "1px solid #303447",
  borderRadius: 9,
  padding: "9px 13px",
  background: "#171a27",
  color: "#f5f6fa",
  fontWeight: 700,
  cursor: "pointer",
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString();
}

function toDateTimeLocal(value: string | null | undefined) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return new Date(
    date.getTime() - date.getTimezoneOffset() * 60000
  ).toISOString().slice(0, 16);
}

function statusColor(status: string) {
  switch (status) {
    case "SCHEDULED":
    case "OPEN":
      return "#f5b82e";
    case "LIVE":
    case "HALF_TIME":
      return "#ff8c42";
    case "FINISHED":
    case "WON":
      return "#58d6a1";
    case "LOST":
    case "CANCELLED":
      return "#ff7777";
    case "POSTPONED":
      return "#b4a0ff";
    default:
      return "#a5acc1";
  }
}

function StatusLabel({ status }: { status: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "5px 9px",
        borderRadius: 20,
        border: `1px solid ${statusColor(status)}55`,
        background: `${statusColor(status)}15`,
        color: statusColor(status),
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: 0.4,
        whiteSpace: "nowrap",
      }}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div
      style={{
        padding: 20,
        border: "1px solid #292d40",
        borderRadius: 15,
        background: "#151824",
        minWidth: 0,
      }}
    >
      <div style={{ color: "#a5acc1", fontSize: 13 }}>{label}</div>
      <div
        style={{
          color: "#f5f6fa",
          fontSize: 30,
          fontWeight: 800,
          marginTop: 9,
        }}
      >
        {value.toLocaleString()}
      </div>
      <div style={{ color: "#7f879d", fontSize: 12, marginTop: 6 }}>
        {detail}
      </div>
    </div>
  );
}

export default function PredictionsManagement() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<FanPrediction[]>([]);
  const [summary, setSummary] = useState<Summary>({
    totalMatches: 0,
    totalPredictions: 0,
    openPredictions: 0,
    wonPredictions: 0,
    lostPredictions: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [matchFilter, setMatchFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"matches" | "predictions">(
    "matches"
  );
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [savingMatch, setSavingMatch] = useState(false);

  const [resultMatch, setResultMatch] = useState<Match | null>(null);
  const [savingResult, setSavingResult] = useState(false);
  const [resultForm, setResultForm] = useState({
    status: "SCHEDULED",
    homeScore: "",
    awayScore: "",
  });
  const [closingMatchId, setClosingMatchId] = useState<number | null>(null);
  const [confirmCloseMatch, setConfirmCloseMatch] = useState<Match | null>(null);
  const [showCreateMatch, setShowCreateMatch] = useState(false);
  const [sports, setSports] = useState<SportOption[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [savingNewMatch, setSavingNewMatch] = useState(false);
  const predictionUploadInProgress = useRef(false);
  const [predictionImageUrl, setPredictionImageUrl] = useState("");
  const [uploadingPredictionImage, setUploadingPredictionImage] =
    useState(false);
  const [predictionImageError, setPredictionImageError] = useState("");
  const [predictionImageUploadFailed, setPredictionImageUploadFailed] =
    useState(false);

  const [createForm, setCreateForm] = useState({
    sportId: "",
    homeTeamId: "",
    awayTeamId: "",
    competition: "",
    venue: "",
    scheduledAt: "",
    predictionClosesAt: "",
  });

  const [editForm, setEditForm] = useState({
    competition: "",
    venue: "",
    scheduledAt: "",
    predictionClosesAt: "",
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await apiFetch("/api/admin/predictions", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to load predictions management."
        );
      }

      setMatches(data.matches ?? []);
      setPredictions(data.predictions ?? []);
      const availableSports: SportOption[] = data.sports ?? [];
      const availableTeams: TeamOption[] = data.teams ?? [];

      setSports(availableSports);
      setTeams(availableTeams);

      setCreateForm((current) => {
        const defaultSport =
          availableSports.find((sport) => sport.slug === "football") ??
          availableSports[0];

        const sportId =
           current.sportId &&
           availableSports.some(
          (sport) => String(sport.id) === current.sportId
         )
           ? current.sportId
           : String(defaultSport?.id ?? "");

       return {
         ...current,
         sportId,
         homeTeamId: "",
         awayTeamId: "",
        };
      });
      setSummary(
        data.summary ?? {
          totalMatches: 0,
          totalPredictions: 0,
          openPredictions: 0,
          wonPredictions: 0,
          lostPredictions: 0,
        }
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load predictions management."
      );


    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
  // Load the initial predictions data when the page mounts.
   // eslint-disable-next-line react-hooks/set-state-in-effect
   void loadData();
  }, [loadData]);

  const filteredMatches = useMemo(() => {
    const term = search.trim().toLowerCase();

    return matches.filter((match) => {
      const matchesStatus =
        matchFilter === "ALL" || match.status === matchFilter;

      const searchableText = [
        match.homeTeam?.name,
        match.awayTeam?.name,
        match.sport?.name,
        match.competition,
        match.venue,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesStatus && (!term || searchableText.includes(term));
    });
  }, [matches, matchFilter, search]);

  const filteredPredictions = useMemo(() => {
    const term = search.trim().toLowerCase();

    return predictions.filter((prediction) => {
      const matchesSelected =
        selectedMatchId === null ||
        prediction.matchId === selectedMatchId;

      const searchableText = [
        prediction.fan.name,
        prediction.match?.homeTeam,
        prediction.match?.awayTeam,
        prediction.match?.competition,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesSelected && (!term || searchableText.includes(term));
    });
  }, [predictions, selectedMatchId, search]);

  function openEditMatch(match: Match) {
    setError("");
    setNotice("");

    setEditForm({
      competition: match.competition ?? "",
      venue: match.venue ?? "",
      scheduledAt: toDateTimeLocal(match.scheduledAt),
      predictionClosesAt: toDateTimeLocal(
        match.predictionClosesAt ?? match.scheduledAt
      ),

    });

    setEditingMatch(match);
  }

  function openManageResult(match: Match) {
    if (match.status === "FINISHED") return;

    setError("");
    setNotice("");
    setEditingMatch(null);

    setResultForm({
      status: match.status,
      homeScore:
        match.homeScore == null ? "" : String(match.homeScore),
      awayScore:
        match.awayScore == null ? "" : String(match.awayScore),
    });

    setResultMatch(match);
  }

  function selectMatch(matchId: number) {
    setSelectedMatchId(matchId);
    setActiveTab("predictions");
    setSearch("");
  }


async function saveMatch() {
  if (!editingMatch) return;

  setSavingMatch(true);
  setError("");
  setNotice("");

  try {
    // Validate the kick-off date before creating the payload.
    const scheduledDate = new Date(editForm.scheduledAt);

    if (
      !editForm.scheduledAt.trim() ||
      Number.isNaN(scheduledDate.getTime())
    ) {
      throw new Error("Please enter a valid kick-off date and time.");
    }

    if (!editForm.predictionClosesAt.trim()) {
      throw new Error(
        "Please enter a prediction closing date and time."
      );
    }

    const predictionClosingTime = new Date(
      editForm.predictionClosesAt
    );

    if (
      !Number.isFinite(predictionClosingTime.getTime()) ||
      predictionClosingTime.getTime() <= Date.now()
    ) {
      throw new Error(
        "Prediction closing time must be in the future."
      );
    }

    // Prepare the update request.
    const payload = {
      competition: editForm.competition.trim(),
      venue: editForm.venue.trim() || null,
      scheduledAt: scheduledDate.toISOString(),
      predictionClosesAt: predictionClosingTime.toISOString(),
    };

    // Send the update to the protected admin API.
    const response = await apiFetch(
      `/api/admin/predictions/${editingMatch.id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || "Unable to update match."
      );
    }

    // Show the API's settlement or cancellation message.
    setNotice(
      data.message || "Match updated successfully."
    );

    setEditingMatch(null);

    // Reload matches, predictions, and summary counts.
    await loadData();
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Unable to update match."
    );
  } finally {
    setSavingMatch(false);
  }
}

async function saveResult() {
  if (!resultMatch || savingResult) return;

  setSavingResult(true);
  setError("");
  setNotice("");

  try {
    if (resultMatch.status === "FINISHED") {
      throw new Error("Finished matches cannot be changed.");
    }

    const allowedStatuses = [
      "SCHEDULED",
      "LIVE",
      "HALF_TIME",
      "FINISHED",
      "POSTPONED",
      "CANCELLED",
    ];

    if (!allowedStatuses.includes(resultForm.status)) {
      throw new Error("Select a valid match status.");
    }

    if (
      resultForm.status === "SCHEDULED" &&
      resultMatch.status !== "SCHEDULED"
    ) {
      throw new Error(
        "A match that has started or changed status cannot return to Scheduled."
      );
    }

    const parseScore = (value: string, label: string) => {
      if (value.trim() === "") return null;

      const score = Number(value);

      if (
        !Number.isInteger(score) ||
        score < 0 ||
        score > 20
      ) {
        throw new Error(
          `${label} must be a whole number from 0 to 20.`
        );
      }

      return score;
    };

    const homeScore = parseScore(
      resultForm.homeScore,
      "Home score"
    );

    const awayScore = parseScore(
      resultForm.awayScore,
      "Away score"
    );

    if (
      resultForm.status === "FINISHED" &&
      (homeScore === null || awayScore === null)
    ) {
      throw new Error(
        "Enter both scores before finishing the match."
      );
    }

    const response = await apiFetch(
      `/api/admin/predictions/${resultMatch.id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: resultForm.status,
          homeScore,
          awayScore,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || "Unable to save match result."
      );
    }

    setNotice(
      data.message || "Match result saved successfully."
    );

    setResultMatch(null);
    await loadData();
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Unable to save match result."
    );
  } finally {
    setSavingResult(false);
  }
}

async function closePredictions(match: Match) {
  if (closingMatchId !== null) return;

  if (
    !["SCHEDULED", "LIVE", "HALF_TIME"].includes(match.status) ||
    match.predictionsClosedAt ||
    new Date(
      match.predictionClosesAt ?? match.scheduledAt
    ).getTime() <= Date.now()
  ) {
    setError("Predictions are no longer open for this match.");
    return;
  }

  setClosingMatchId(match.id);
  setError("");
  setNotice("");

  try {
    const response = await apiFetch(
      `/api/admin/predictions/${match.id}/close`,
      { method: "PATCH" }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Unable to close predictions.");
    }

    setConfirmCloseMatch(null);
    setNotice(data.message || "Predictions closed successfully.");
    await loadData();
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Unable to close predictions."
    );
  } finally {
    setClosingMatchId(null);
  }
}

function resetPredictionImage() {
  setPredictionImageUrl("");
  setPredictionImageError("");
  setPredictionImageUploadFailed(false);
}

async function uploadPredictionImage(file: File) {
  if (predictionUploadInProgress.current) {
    return;
  }

  predictionUploadInProgress.current = true;
  setPredictionImageUrl("");
  setPredictionImageError("");
  setPredictionImageUploadFailed(false);

  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size === 0 ||
    file.size > 2 * 1024 * 1024
  ) {
    setPredictionImageError(
      "Choose a JPG, PNG or WebP image no larger than 2 MB."
    );
    setPredictionImageUploadFailed(true);
    predictionUploadInProgress.current = false;
    return;
  }

  setUploadingPredictionImage(true);

  try {
    const formData = new FormData();
    formData.append("category", "predictions");
    formData.append("image", file);

    const response = await apiFetch("/api/admin/uploads/image", {
      method: "POST",
      headers: { "X-Image-Category": "predictions" },
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Unable to upload image.");
    }

    if (typeof data.imageUrl !== "string" || !data.imageUrl) {
      throw new Error("The image upload returned an invalid URL.");
    }

    setPredictionImageUrl(data.imageUrl);
  } catch (error) {
    setPredictionImageUploadFailed(true);
    setPredictionImageError(
      error instanceof Error
        ? error.message
        : "Unable to upload prediction image."
    );
  } finally {
    predictionUploadInProgress.current = false;
    setUploadingPredictionImage(false);
  }
}

async function createMatch() {
  if (predictionUploadInProgress.current || uploadingPredictionImage) {
    setError("Wait for the prediction image upload to finish.");
    return;
  }

  if (predictionImageUploadFailed) {
    setError(
      "Remove the failed image selection or upload another image."
    );
    return;
  }

  setSavingNewMatch(true);
  setError("");
  setNotice("");

  try {
    if (
      !createForm.sportId ||
      !createForm.homeTeamId ||
      !createForm.awayTeamId
    ) {
      throw new Error(
        "Select a sport, home team and away team."
      );
    }

    if (!createForm.scheduledAt) {
      throw new Error("Enter the kickoff date and time.");
    }

    const kickoff = new Date(createForm.scheduledAt);

    if (
      Number.isNaN(kickoff.getTime()) ||
      kickoff.getTime() <= Date.now()
    ) {
      throw new Error(
        "Choose a valid kickoff time in the future."
      );
    }

    if (!createForm.predictionClosesAt) {
      throw new Error("Enter the prediction closing date and time.");
    }

    const predictionClosingTime = new Date(
      createForm.predictionClosesAt
    );

    if (
      Number.isNaN(predictionClosingTime.getTime()) ||
      predictionClosingTime.getTime() <= Date.now()
    ) {
      throw new Error(
        "Choose a valid prediction closing time in the future."
      );
    }

    const response = await apiFetch("/api/admin/predictions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sportId: Number(createForm.sportId),
        homeTeamId: Number(createForm.homeTeamId),
        awayTeamId: Number(createForm.awayTeamId),
        competition: createForm.competition,
        venue: createForm.venue,
        imageUrl: predictionImageUrl || null,
        scheduledAt: kickoff.toISOString(),
        predictionClosesAt: predictionClosingTime.toISOString(),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Unable to create match.");
    }

    setShowCreateMatch(false);
    setPredictionImageUrl("");
    setPredictionImageError("");
    setPredictionImageUploadFailed(false);
    setNotice(data.message || "Community match created successfully.");

    setCreateForm((current) => ({
      ...current,
      homeTeamId: "",
      awayTeamId: "",
      competition: "",
      venue: "",
      scheduledAt: "",
      predictionClosesAt: "",
    }));

    await loadData();
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Unable to create match."
    );
  } finally {
    setSavingNewMatch(false);
  }
}


function exportPredictionsToExcel() {
  if (filteredPredictions.length === 0) {
    setNotice("There are no fan predictions matching the current filters to export.");
    setError("");
    return;
  }

  const rows = filteredPredictions.map((prediction) => ({
    "Prediction ID": prediction.id,
    Fan: prediction.fan.name,
    "Fan ID": prediction.userId,
    Match: `${prediction.match?.homeTeam ?? "Home"} vs ${
      prediction.match?.awayTeam ?? "Away"
    }`,
    Competition: prediction.match?.competition ?? "",
    "Predicted Home Score": prediction.homeScore,
    "Predicted Away Score": prediction.awayScore,
    "Actual Home Score":
      prediction.match?.status === "FINISHED"
        ? prediction.match.homeScore
        : null,
    "Actual Away Score":
      prediction.match?.status === "FINISHED"
        ? prediction.match.awayScore
        : null,
    "Prediction Status": prediction.status,
    "Points Awarded": prediction.pointsAwarded,
    "Submitted At": prediction.createdAt
      ? new Date(prediction.createdAt)
      : null,
  }));

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);

  worksheet["!cols"] = [
    { wch: 15 },
    { wch: 24 },
    { wch: 12 },
    { wch: 32 },
    { wch: 25 },
    { wch: 20 },
    { wch: 20 },
    { wch: 18 },
    { wch: 18 },
    { wch: 20 },
    { wch: 16 },
    { wch: 24 },
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, "Fan Predictions");

  XLSX.writeFile(
    workbook,
    `SportyFanz_Predictions_${new Date().toISOString().slice(0, 10)}.xlsx`
  );

  setError("");
  setNotice(`Exported ${rows.length} fan predictions to Excel.`);
}


function exportMatchesToExcel() {
  if (filteredMatches.length === 0) {
    setNotice("There are no matches matching the current filters to export.");
    setError("");
    return;
  }

  const rows = filteredMatches.map((match) => {
    const matchPredictions = predictions.filter(
      (prediction) => prediction.matchId === match.id
    );

    return {
      "Match ID": match.id,
      "Home Team": match.homeTeam?.name ?? "",
      "Away Team": match.awayTeam?.name ?? "",
      Sport: match.sport?.name ?? "",
      Competition: match.competition ?? "",
      Venue: match.venue ?? "",
      "Kickoff Date and Time": new Date(match.scheduledAt),
      "Home Score": match.homeScore ?? "",
      "Away Score": match.awayScore ?? "",
      "Match Status": match.status,
      "Total Predictions": match.predictionCount ?? matchPredictions.length,
      "Open Predictions": matchPredictions.filter(
        (prediction) => prediction.status === "OPEN"
      ).length,
      "Won Predictions": matchPredictions.filter(
        (prediction) => prediction.status === "WON"
      ).length,
      "Lost Predictions": matchPredictions.filter(
        (prediction) => prediction.status === "LOST"
      ).length,
      "Cancelled Predictions": matchPredictions.filter(
        (prediction) => prediction.status === "CANCELLED"
      ).length,
    };
  });

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);

  worksheet["!cols"] = [
    { wch: 12 },
    { wch: 24 },
    { wch: 24 },
    { wch: 18 },
    { wch: 28 },
    { wch: 28 },
    { wch: 25 },
    { wch: 12 },
    { wch: 12 },
    { wch: 18 },
    { wch: 20 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 22 },
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, "Matches");

  XLSX.writeFile(
    workbook,
    `SportyFanz_Matches_${new Date().toISOString().slice(0, 10)}.xlsx`
  );

  setError("");
  setNotice(`Exported ${rows.length} matches to Excel.`);
}


  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0c0e16",
        color: "#f5f6fa",
        padding: "28px clamp(16px, 3vw, 36px)",
      }}
    >
      <div style={{ maxWidth: 1500, margin: "0 auto" }}>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 18,
            flexWrap: "wrap",
            marginBottom: 26,
          }}
        >
          <div>
            <div
              style={{
                color: "#f5b82e",
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: 2,
                textTransform: "uppercase",
              }}
            >
              SPORTYFANZ ADMIN
            </div>
            <h1
              style={{
                fontSize: "clamp(25px, 3vw, 34px)",
                margin: "9px 0 7px",
                fontWeight: 850,
              }}
            >
              Predictions Management
            </h1>
            <p style={{ color: "#a5acc1", margin: 0, fontSize: 14 }}>
              Monitor matches, fan predictions, and prediction outcomes.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setNotice("");
              void loadData();
            }}
            disabled={loading}
            style={{
              ...buttonStyle,
              borderColor: "#f5b82e66",
              color: "#f5b82e",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "Refreshing..." : "↻ Refresh data"}

          </button>
        </header>

        {error && (
          <div
            role="alert"
            style={{
              padding: 14,
              borderRadius: 10,
              border: "1px solid #ff777755",
              background: "#ff777710",
              color: "#ff9999",
              marginBottom: 18,
            }}
          >
            {error}
          </div>
        )}

        {notice && (
          <div
            role="status"
            style={{
              padding: 14,
              borderRadius: 10,
              background: "#58d6a110",
              color: "#58d6a1",
              marginBottom: 18,
            }}
          >
            {notice}
          </div>
        )}

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(185px, 1fr))",
            gap: 14,
            marginBottom: 28,
          }}
        >
          {editingMatch && (
       <section
         style={{
           padding: 22,
           marginBottom: 24,
           border: "1px solid #f5b82e66",
           borderRadius: 15,
           background: "#151824",
        }}
      >
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 12,
        flexWrap: "wrap",
        marginBottom: 20,
      }}
    >
      <div>
        <div
          style={{
            color: "#f5b82e",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: 1.5,
          }}
        >
          MATCH #{editingMatch.id}
        </div>

        <h2 style={{ margin: "8px 0", fontSize: 22 }}>
          Edit match
        </h2>

        <p style={{ color: "#a5acc1", margin: 0, fontSize: 13 }}>
          {editingMatch.homeTeam?.name ?? "Home team"} vs{" "}
          {editingMatch.awayTeam?.name ?? "Away team"}
        </p>
      </div>

      <button
        type="button"
        onClick={() => setEditingMatch(null)}
        style={buttonStyle}
        disabled={savingMatch}
      >
        Close
      </button>
    </div>

    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 16,
      }}
    >
      <label style={{ color: "#a5acc1", fontSize: 12 }}>
        Competition
        <input
          value={editForm.competition}
          onChange={(event) =>
            setEditForm({ ...editForm, competition: event.target.value })
          }
          maxLength={200}
          placeholder="e.g. Premier League"
          style={{ ...inputStyle, marginTop: 7 }}
        />
      </label>

      <label style={{ color: "#a5acc1", fontSize: 12 }}>
        Venue
        <input
          value={editForm.venue}
          onChange={(event) =>
            setEditForm({ ...editForm, venue: event.target.value })
          }
          maxLength={200}
          placeholder="Stadium name"
          style={{ ...inputStyle, marginTop: 7 }}
        />
      </label>

      <label style={{ color: "#a5acc1", fontSize: 12 }}>
        Kick-off date and time
        <input
          type="datetime-local"
          value={editForm.scheduledAt}
          onChange={(event) =>
            setEditForm({ ...editForm, scheduledAt: event.target.value })
          }
          onClick={(event) => {
          const input = event.currentTarget;
             if ("showPicker" in HTMLInputElement.prototype) {
               input.showPicker();
             }
           }}
          required
          style={{ ...inputStyle, marginTop: 7 }}
        />
      </label>

      <label style={{ color: "#a5acc1", fontSize: 12 }}>
        Prediction closing date and time
        <input
          type="datetime-local"
          value={editForm.predictionClosesAt}
          onChange={(event) =>
            setEditForm({
              ...editForm,
              predictionClosesAt: event.target.value,
            })
          }
          required
          style={{ ...inputStyle, marginTop: 7 }}
        />
        <span
          style={{
            display: "block",
            color: "#7f879d",
            fontSize: 11,
            marginTop: 5,
          }}
        >
          Closing time must be in the future and before kickoff.
          Once predictions close or expire, match details are locked.
        </span>
      </label>
    </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          marginTop: 22,
        }}
        >
        <button
          type="button"
          onClick={() => void saveMatch()}
          disabled={savingMatch}
          style={{
            ...buttonStyle,
            background: "#f5b82e",
            color: "#171717",
            borderColor: "#f5b82e",
            opacity: savingMatch ? 0.6 : 1,
          }}
          >
           {savingMatch ? "Saving..." : "Save match changes"}
          </button>

           <button
             type="button"
             onClick={() => setEditingMatch(null)}
             disabled={savingMatch}
             style={buttonStyle}
            >
                  Discard
               </button>
             </div>
            </section>
          )}

          {resultMatch && (
            <section
              style={{
                gridColumn: "1 / -1",
                padding: 22,
                marginBottom: 24,
                borderRadius: 12,
                border: "1px solid #7ccf7244",
                background: "#101b2b",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                  marginBottom: 20,
                }}
              >
                <div>
                  <div
                    style={{
                      color: "#7ccf72",
                      fontSize: 11,
                      fontWeight: 800,
                    }}
                  >
                    MATCH #{resultMatch.id}
                  </div>
                  <h2 style={{ margin: "8px 0", fontSize: 22 }}>
                    Manage Match Result
                  </h2>
                  <p style={{ color: "#a5acc1", fontSize: 13 }}>
                    {resultMatch.homeTeam?.name ?? "Home team"} vs{" "}
                    {resultMatch.awayTeam?.name ?? "Away team"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setResultMatch(null)}
                  disabled={savingResult}
                  style={buttonStyle}
                >
                  Close
                </button>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 16,
                }}
              >
                <label style={{ color: "#a5acc1", fontSize: 12 }}>
                  Match status
                  <select
                    value={resultForm.status}
                    onChange={(event) =>
                      setResultForm({
                        ...resultForm,
                        status: event.target.value,
                      })
                    }
                    style={{ ...inputStyle, marginTop: 7 }}
                  >
                    <option value="SCHEDULED">Scheduled</option>
                    <option value="LIVE">Live</option>
                    <option value="HALF_TIME">Half time</option>
                    <option value="FINISHED">
                      Finished — settle predictions
                    </option>
                    <option value="POSTPONED">Postponed</option>
                    <option value="CANCELLED">
                      Cancelled — cancel open predictions
                    </option>
                  </select>
                </label>

                <label style={{ color: "#a5acc1", fontSize: 12 }}>
                  {resultMatch.homeTeam?.name ?? "Home"} score
                  <input
                    type="number"
                    min={0}
                    max={20}
                    step={1}
                    value={resultForm.homeScore}
                    onChange={(event) =>
                      setResultForm({
                        ...resultForm,
                        homeScore: event.target.value,
                      })
                    }
                    placeholder="Home score"
                    style={{ ...inputStyle, marginTop: 7 }}
                  />
                </label>

                <label style={{ color: "#a5acc1", fontSize: 12 }}>
                  {resultMatch.awayTeam?.name ?? "Away"} score
                  <input
                    type="number"
                    min={0}
                    max={20}
                    step={1}
                    value={resultForm.awayScore}
                    onChange={(event) =>
                      setResultForm({
                        ...resultForm,
                        awayScore: event.target.value,
                      })
                    }
                    placeholder="Away score"
                    style={{ ...inputStyle, marginTop: 7 }}
                  />
                </label>
              </div>

              <p
                style={{
                  color: "#a5acc1",
                  fontSize: 12,
                  marginTop: 16,
                }}
              >
                Result management does not change kickoff,
                prediction closing time, or match details.
                Finishing a match settles its open predictions.
              </p>

              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button
                  type="button"
                  onClick={() => void saveResult()}
                  disabled={savingResult}
                  style={{
                    ...buttonStyle,
                    background: "#7ccf72",
                    color: "#102015",
                    borderColor: "#7ccf72",
                    opacity: savingResult ? 0.6 : 1,
                    cursor: savingResult ? "not-allowed" : "pointer",
                  }}
                >
                  {savingResult ? "Saving..." : "Save Result"}
                </button>
                <button
                  type="button"
                  onClick={() => setResultMatch(null)}
                  disabled={savingResult}
                  style={buttonStyle}
                >
                  Discard
                </button>
              </div>
            </section>
          )}

          <SummaryCard
            label="Total matches"
            value={summary.totalMatches}
            detail="Matches in the system"
          />
          <SummaryCard
            label="Total predictions"
            value={summary.totalPredictions}
            detail="Fan submissions recorded"
          />
          <SummaryCard
            label="Awaiting resolution"
            value={summary.openPredictions}
            detail="Predictions still open"
          />
          <SummaryCard
            label="Won predictions"
            value={summary.wonPredictions}
            detail="Marked as correct"
          />
          <SummaryCard
            label="Lost predictions"
            value={summary.lostPredictions}
            detail="Marked as incorrect"
          />
        </section>

        <section
          style={{
            border: "1px solid #292d40",
            borderRadius: 15,
            background: "#11141f",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 8,
              padding: 15,
              borderBottom: "1px solid #292d40",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab("matches")}
              style={{
                ...buttonStyle,
                background:
                  activeTab === "matches" ? "#f5b82e" : "#171a27",
                color: activeTab === "matches" ? "#171717" : "#f5f6fa",
                borderColor:
                  activeTab === "matches" ? "#f5b82e" : "#303447",
              }}
            >
              Matches ({matches.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("predictions")}
              style={{
                ...buttonStyle,
                background:
                  activeTab === "predictions" ? "#f5b82e" : "#171a27",
                color:
                  activeTab === "predictions" ? "#171717" : "#f5f6fa",
                borderColor:
                  activeTab === "predictions" ? "#f5b82e" : "#303447",
              }}
            >
              Fan predictions ({predictions.length})
            </button>
            <button
            type="button"
             onClick={() => setShowCreateMatch(true)}
             style={{
              ...buttonStyle,
              background: "#f5b82e",
              color: "#171717",
              borderColor: "#f5b82e",
              marginLeft: "auto",
             }}
           >
             + Create Match
           </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(180px, 1fr) minmax(180px, 2fr)",
              gap: 12,
              padding: 15,
              borderBottom: "1px solid #292d40",
            }}
          >
            {activeTab === "matches" ? (
              <select
                aria-label="Filter matches by status"
                value={matchFilter}
                onChange={(event) => setMatchFilter(event.target.value)}
                style={inputStyle}
              >
                <option value="ALL">All match statuses</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="LIVE">Live</option>
                <option value="HALF_TIME">Half time</option>
                <option value="FINISHED">Finished</option>
                <option value="POSTPONED">Postponed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            ) : (
              <select
                aria-label="Filter predictions by match"
                value={selectedMatchId ?? ""}
                onChange={(event) =>
                  setSelectedMatchId(
                    event.target.value ? Number(event.target.value) : null
                  )
                }
                style={inputStyle}
              >
                <option value="">All matches</option>
                {matches.map((match) => (
                  <option key={match.id} value={match.id}>
                    {match.homeTeam?.name ?? "Home"} vs{" "}
                    {match.awayTeam?.name ?? "Away"}
                  </option>
                ))}
              </select>
            )}

            <input
              aria-label={
                activeTab === "matches"
                  ? "Search matches"
                  : "Search fan predictions"
              }
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={
                activeTab === "matches"
                  ? "Search team, sport, competition, venue..."
                  : "Search fan, team, or competition..."
              }
              style={inputStyle}
            />
            {activeTab === "matches" && (
           <button
             type="button"
             onClick={exportMatchesToExcel}
             disabled={loading || filteredMatches.length === 0}
             style={{
               ...buttonStyle,
               borderColor: "#58d6a166",
               color: "#58d6a1",
               opacity: loading || filteredMatches.length === 0 ? 0.6 : 1,
               whiteSpace: "nowrap",
               flexShrink: 0,
              }}
            >
             ↓ Export to Excel
            </button>
            )}
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#a5acc1" }}>
              Loading predictions management...
            </div>
          ) : activeTab === "matches" ? (
            filteredMatches.length === 0 ? (
              <div
                style={{
                  padding: 40,
                  textAlign: "center",
                  color: "#a5acc1",
                }}
              >
                {matches.length === 0
                  ? "No matches found yet."
                  : "No matches match your filters."}

              </div>

            ) : (

              <div style={{ overflowX: "auto" }}>

                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    minWidth: 850,
                    fontSize: 13,
                  }}
                >
                  <thead>
                    <tr style={{ background: "#171a27", color: "#a5acc1" }}>
                      {[
                        "MATCH",
                        "SPORT / COMPETITION",
                        "KICK-OFF",
                        "SCORE",
                        "STATUS",
                        "PREDICTIONS",
                        "ACTION",
                      ].map((heading) => (
                        <th
                          key={heading}
                          style={{
                            padding: "14px 16px",
                            textAlign: "left",
                            fontSize: 10,
                            letterSpacing: 0.8,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMatches.map((match) => (
                      <tr
                        key={match.id}
                        style={{ borderTop: "1px solid #292d40" }}
                      >
                        <td style={{ padding: 16, minWidth: 220 }}>
                          <div style={{ fontWeight: 750 }}>
                            {match.homeTeam?.name ?? "Home team"}
                          </div>
                          <div style={{ color: "#7f879d", margin: "5px 0" }}>
                            vs
                          </div>
                          <div style={{ fontWeight: 750 }}>
                            {match.awayTeam?.name ?? "Away team"}
                          </div>

                          {match.imageUrl && (
                            <img
                              src={match.imageUrl}
                              alt={`Image for ${match.homeTeam?.name ?? "Home"} vs ${match.awayTeam?.name ?? "Away"}`}
                              loading="lazy"
                              style={{
                                display: "block",
                                width: "100%",
                                maxWidth: 220,
                                maxHeight: 140,
                                objectFit: "contain",
                                borderRadius: 8,
                                marginTop: 12,
                                marginBottom: 10,
                                border: "1px solid #303447",
                              }}
                            />
                          )}

                          <div
                            style={{
                              color: "#7f879d",
                              fontSize: 11,
                              marginTop: 7,
                            }}
                          >
                            Match #{match.id}
                          </div>
                        </td>
                        <td style={{ padding: 16 }}>
                          <div>{match.sport?.name ?? "—"}</div>
                          <div
                            style={{
                              color: "#7f879d",
                              marginTop: 5,
                              maxWidth: 190,
                            }}
                          >
                            {match.competition || "No competition specified"}
                          </div>
                        </td>
                        <td
                          style={{
                            padding: 16,
                            whiteSpace: "nowrap",
                            color: "#c3c8d6",
                          }}
                        >
                          <div>{formatDate(match.scheduledAt)}</div>
                          <div
                            style={{
                              color: "#7f879d",
                              fontSize: 11,
                              marginTop: 6,
                            }}
                          >
                            Predictions close:{" "}
                            {formatDate(
                              match.predictionClosesAt ??
                                match.scheduledAt
                            )}
                          </div>
                        </td>
                        <td
                          style={{
                            padding: 16,
                            fontSize: 18,
                            fontWeight: 850,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {match.homeScore} - {match.awayScore}
                        </td>
                        <td style={{ padding: 16 }}>
                          <StatusLabel status={match.status} />
                          <div style={{ marginTop: 7, fontSize: 12 }}>
                            {match.predictionsClosedAt ? (
                              <span style={{ color: "#ff7777" }}>
                                Predictions Closed
                              </span>
                            ) : !["SCHEDULED", "LIVE", "HALF_TIME"].includes(
                              match.status
                            ) ? (
                              <span style={{ color: "#a5acc1" }}>
                                Predictions Unavailable
                              </span>
                            ) : new Date(
                              match.predictionClosesAt ??
                                match.scheduledAt
                            ).getTime() <= Date.now() ? (
                              <span style={{ color: "#ff8c42" }}>
                                Deadline Passed
                              </span>
                            ) : (
                              <span style={{ color: "#58d6a1" }}>
                                Predictions Open
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: 16 }}>
                          <div style={{ fontSize: 17, fontWeight: 800 }}>
                            {match.predictionCount}
                          </div>
                          <div
                            style={{
                              color: "#7f879d",
                              fontSize: 11,
                              marginTop: 4,
                            }}
                          >
                            {match.openPredictions} open
                          </div>
                        </td>
                        <td style={{ padding: 16 }}>
                           <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                         <button
                           type="button"
                           onClick={() => selectMatch(match.id)}
                            style={{
                             ...buttonStyle,
                             color: "#f5b82e",
                            }}
                          >
                             View predictions
                          </button>
                          {match.status !== "FINISHED" &&
                            match.status !== "CANCELLED" && (
                            <button
                              type="button"
                              onClick={() => openManageResult(match)}
                              disabled={savingResult}
                              style={{
                                ...buttonStyle,
                                color: "#7ccf72",
                                borderColor: "#7ccf7255",
                              }}
                            >
                              Manage Result
                            </button>
                          )}
                          {match.status === "SCHEDULED" &&
                            !match.predictionsClosedAt &&
                            new Date(
                              match.predictionClosesAt ??
                                match.scheduledAt
                            ).getTime() > Date.now() && (
                            <button
                              type="button"
                              onClick={() => openEditMatch(match)}
                              disabled={savingMatch}
                              style={{
                                ...buttonStyle,
                                color: "#3c94d9",
                                borderColor: "#3c94d955",
                              }}
                            >
                              Edit Match
                            </button>
                          )}
                          {["SCHEDULED", "LIVE", "HALF_TIME"].includes(match.status) &&
                            !match.predictionsClosedAt &&
                            new Date(
                              match.predictionClosesAt ??
                                match.scheduledAt
                            ).getTime() > Date.now() && (
                              <button
                                type="button"
                                disabled={closingMatchId !== null}
                                onClick={() => { setError(""); setConfirmCloseMatch(match); }}
                                style={{
                                  ...buttonStyle,
                                  color: "#ff7777",
                                  borderColor: "#ff777755",
                                  opacity:
                                    closingMatchId !== null ? 0.6 : 1,
                                  cursor:
                                    closingMatchId !== null
                                      ? "not-allowed"
                                      : "pointer",
                                }}
                              >
                                {closingMatchId === match.id
                                  ? "Closing..."
                                  : "Close Predictions"}
                              </button>
                            )}


                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : filteredPredictions.length === 0 ? (
            <div
              style={{
                padding: 40,
                textAlign: "center",
                color: "#a5acc1",
              }}
            >
              No fan predictions match your filters.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  minWidth: 850,
                  fontSize: 13,
                }}
              >
                <thead>
                  <tr style={{ background: "#171a27", color: "#a5acc1" }}>
                    {[
                      "FAN",
                      "MATCH",
                      "FAN PREDICTION",
                      "ACTUAL SCORE",
                      "STATUS",
                      "POINTS AWARDED",
                      "SUBMITTED",
                    ].map((heading) => (
                      <th
                        key={heading}
                        style={{
                          padding: "14px 16px",
                          textAlign: "left",
                          fontSize: 10,
                          letterSpacing: 0.8,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {heading}

                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredPredictions.map((prediction) => (
                    <tr
                      key={prediction.id}
                      style={{ borderTop: "1px solid #292d40" }}
                    >
                      <td style={{ padding: 16 }}>
                        <div style={{ fontWeight: 750 }}>
                          {prediction.fan.name}
                        </div>
                        <div
                          style={{
                            color: "#7f879d",
                            fontSize: 11,
                            marginTop: 5,
                          }}
                        >
                          Fan #{prediction.userId}
                        </div>
                      </td>
                      <td style={{ padding: 16, minWidth: 180 }}>
                        <div style={{ fontWeight: 700 }}>
                          {prediction.match?.homeTeam ?? "Home team"}
                        </div>
                        <div style={{ color: "#7f879d", margin: "4px 0" }}>
                          vs
                        </div>
                        <div style={{ fontWeight: 700 }}>
                          {prediction.match?.awayTeam ?? "Away team"}
                        </div>
                        <div
                          style={{
                            color: "#7f879d",
                            fontSize: 11,
                            marginTop: 7,
                          }}
                        >
                          Match #{prediction.matchId}
                        </div>
                      </td>
                      <td
                        style={{
                          padding: 16,
                          fontSize: 18,
                          fontWeight: 850,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {prediction.homeScore} - {prediction.awayScore}
                      </td>
                      <td
                        style={{
                          padding: 16,
                          fontSize: 18,
                          fontWeight: 850,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {prediction.match &&
                        prediction.match.status === "FINISHED"
                          ? `${prediction.match.homeScore} - ${prediction.match.awayScore}`
                          : "—"}
                      </td>
                      <td style={{ padding: 16 }}>
                        <StatusLabel status={prediction.status} />
                      </td>
                      <td style={{ padding: 16 }}>
                        {prediction.pointsAwarded.toLocaleString()}
                      </td>
                      <td
                        style={{
                          padding: 16,
                          whiteSpace: "nowrap",
                          color: "#a5acc1",
                        }}
                      >
                        {formatDate(prediction.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

{showCreateMatch && (
  <div
    style={{
      position: "fixed",
      inset: 0,
      zIndex: 100,
      background: "rgba(0,0,0,0.78)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
      overflowY: "auto",
    }}
    onClick={() => {
      if (!savingNewMatch && !uploadingPredictionImage) {
        resetPredictionImage();
        setShowCreateMatch(false);
      }
    }}
  >
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-match-title"
      style={{
        width: "100%",
        maxWidth: 620,
        maxHeight: "90vh",
        overflowY: "auto",
        background: "#151824",
        border: "1px solid #303447",
        borderRadius: 16,
        padding: 24,
        color: "#f5f6fa",
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginBottom: 8,
        }}
      >
        <h2
          id="create-match-title"
          style={{ margin: 0, fontSize: 22, fontWeight: 800 }}
        >
          Create Prediction
        </h2>

        <button
          type="button"
          disabled={savingNewMatch || uploadingPredictionImage}
          onClick={() => {
            resetPredictionImage();
            setShowCreateMatch(false);
          }}
          style={buttonStyle}
        >
          Close
        </button>
      </div>

      <p style={{ color: "#a5acc1", fontSize: 13, lineHeight: 1.6 }}>
        Create a scheduled local, school, academy or community fixture.
        Professional fixtures should be imported through API-Football.
      </p>

      <div style={{ display: "grid", gap: 16, marginTop: 22 }}>
        <label style={{ color: "#a5acc1", fontSize: 12 }}>
          Sport
          <select
            value={createForm.sportId}
            onChange={(event) =>
              setCreateForm({
                ...createForm,
                sportId: event.target.value,
                homeTeamId: "",
                awayTeamId: "",
              })
            }
            style={{ ...inputStyle, marginTop: 7 }}
            required
          >
            <option value="">Select sport</option>
            {sports.map((sport) => (
              <option key={sport.id} value={sport.id}>
                {sport.name}
              </option>
            ))}
          </select>
        </label>

        <label style={{ color: "#a5acc1", fontSize: 12 }}>
          Home team
          <select
            value={createForm.homeTeamId}
            onChange={(event) =>
              setCreateForm({
                ...createForm,
                homeTeamId: event.target.value,
              })
            }
            style={{ ...inputStyle, marginTop: 7 }}
            required
          >
            <option value="">Select home team</option>
            {teams
              .filter(
                (team) =>
                  String(team.sportId) === createForm.sportId
              )
              .map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
          </select>
        </label>

        <label style={{ color: "#a5acc1", fontSize: 12 }}>
          Away team
          <select
            value={createForm.awayTeamId}
            onChange={(event) =>
              setCreateForm({
                ...createForm,
                awayTeamId: event.target.value,
              })
            }
            style={{ ...inputStyle, marginTop: 7 }}
            required
          >
            <option value="">Select away team</option>
            {teams
              .filter(
                (team) =>
                  String(team.sportId) === createForm.sportId &&
                  String(team.id) !== createForm.homeTeamId
              )
              .map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
          </select>
        </label>

        <label style={{ color: "#a5acc1", fontSize: 12 }}>
          Competition / event name
          <input
            value={createForm.competition}
            onChange={(event) =>
              setCreateForm({
                ...createForm,
                competition: event.target.value,
              })
            }
            maxLength={200}
            placeholder="e.g. Lagos Community League"
            style={{ ...inputStyle, marginTop: 7 }}
            required
          />
        </label>

        <label style={{ color: "#a5acc1", fontSize: 12 }}>
          Kickoff date and time
        <input
          type="datetime-local"
          value={createForm.scheduledAt}
          onChange={(event) =>
           setCreateForm({
            ...createForm,
            scheduledAt: event.target.value,
           })
          }
          onClick={(event) => {
            const input = event.currentTarget;
            if (typeof input.showPicker === "function") {
               input.showPicker();
             }
           }}
               min={new Date(
               Date.now() - new Date().getTimezoneOffset() * 60000
              )
              .toISOString()
              .slice(0, 16)}
            style={{ ...inputStyle, marginTop: 7 }}
            required
          />
        </label>
        <label style={{ color: "#a5acc1", fontSize: 12 }}>
          Prediction closing date and time
          <input
            type="datetime-local"
            value={createForm.predictionClosesAt}
            onChange={(event) =>
              setCreateForm({
                ...createForm,
                predictionClosesAt: event.target.value,
              })
            }
            onClick={(event) => {
              const input = event.currentTarget;
              if (typeof input.showPicker === "function") {
                input.showPicker();
              }
            }}
            min={new Date(
              Date.now() - new Date().getTimezoneOffset() * 60000
            ).toISOString().slice(0, 16)}
            style={{ ...inputStyle, marginTop: 7 }}
            required
          />
        </label>

        <div style={{ display: "grid", gap: 10 }}>
          <label
            htmlFor="prediction-image-upload"
            style={{ color: "#a5acc1", fontSize: 12 }}
          >
            Prediction image (optional)
          </label>

          <input
            id="prediction-image-upload"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={uploadingPredictionImage || savingNewMatch}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];

              if (file) {
                void uploadPredictionImage(file);
              }

              event.currentTarget.value = "";
            }}
            style={{ ...inputStyle, padding: 10 }}
          />

          <span style={{ color: "#7f879d", fontSize: 12 }}>
            JPG, PNG or WebP. Maximum file size: 2 MB.
          </span>

          {uploadingPredictionImage && (
            <p role="status" style={{ color: "#f5b82e", margin: 0 }}>
              Uploading image...
            </p>
          )}

          {predictionImageError && (
            <p role="alert" style={{ color: "#ff7777", margin: 0 }}>
              {predictionImageError}
            </p>
          )}

          {predictionImageUrl && (
            <div style={{ display: "grid", gap: 10 }}>
              <img
                src={predictionImageUrl}
                alt="Prediction image preview"
                style={{
                  width: "100%",
                  maxHeight: 220,
                  objectFit: "contain",
                  borderRadius: 10,
                  border: "1px solid #303447",
                  background: "#10121b",
                }}
              />

              <span style={{ color: "#58d6a1", fontSize: 12 }}>
                Image uploaded successfully.
              </span>

              <button
                type="button"
                disabled={uploadingPredictionImage || savingNewMatch}
                onClick={resetPredictionImage}
                style={{ ...buttonStyle, justifySelf: "start" }}
              >
                Remove Image
              </button>
            </div>
          )}

          {predictionImageUploadFailed && (
            <button
              type="button"
              disabled={uploadingPredictionImage || savingNewMatch}
              onClick={resetPredictionImage}
              style={{ ...buttonStyle, justifySelf: "start" }}
            >
              Clear Failed Selection
            </button>
          )}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 10,
          flexWrap: "wrap",
          marginTop: 24,
        }}
      >
        <button
          type="button"
          disabled={savingNewMatch || uploadingPredictionImage}
          onClick={() => {
            resetPredictionImage();
            setShowCreateMatch(false);
          }}
          style={buttonStyle}
        >
          Cancel
        </button>

        <button
          type="button"
          disabled={savingNewMatch || uploadingPredictionImage || predictionImageUploadFailed || sports.length === 0 || teams.length < 2}
          onClick={() => void createMatch()}
          style={{
            ...buttonStyle,
            background: "#f5b82e",
            color: "#171717",
            borderColor: "#f5b82e",
            opacity: savingNewMatch ? 0.6 : 1,
          }}
        >
          {savingNewMatch ? "Creating..." : "Create Match"}
          </button>
        </div>
        </section>
      </div>
    )}
    {confirmCloseMatch && (
      <div
        role="presentation"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1000,
          background: "rgba(0, 0, 0, 0.75)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
        }}
      >
        <section
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-predictions-close-title"
          aria-describedby="confirm-predictions-close-description"
          style={{
            width: "100%",
            maxWidth: 460,
            background: "#151824",
            border: "1px solid #414656",
            borderRadius: 16,
            padding: 26,
            boxShadow: "0 24px 70px rgba(0,0,0,0.45)",
            color: "#f5f5f5",
          }}
        >
          <h2
            id="confirm-predictions-close-title"
            style={{ fontSize: 22, margin: "0 0 14px" }}
          >
            Close Predictions?
          </h2>

          <p
            id="confirm-predictions-close-description"
            style={{ lineHeight: 1.7 }}
          >
            Are you sure you want to close predictions for
            {" "}
            <strong>
              {confirmCloseMatch.homeTeam?.name ?? "Home team"}
              {" vs "}
              {confirmCloseMatch.awayTeam?.name ?? "Away team"}
            </strong>
            ?
            <span style={{ display: "block", marginTop: 12 }}>
              Fans will no longer be able to submit predictions.
              Existing predictions and Fan Points will be preserved.
            </span>
          </p>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 12,
              marginTop: 24,
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              disabled={closingMatchId !== null}
              onClick={() => setConfirmCloseMatch(null)}
              style={{
                ...buttonStyle,
                background: "transparent",
                border: "1px solid #555b6b",
                color: "#ffffff",
              }}
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={closingMatchId !== null}
              onClick={() => void closePredictions(confirmCloseMatch)}
              style={{
                ...buttonStyle,
                background: "#b83f50",
                borderColor: "#b83f50",
                color: "#ffffff",
                opacity: closingMatchId !== null ? 0.6 : 1,
              }}
            >
              {closingMatchId !== null
                ? "Closing..."
                : "Close Predictions"}
            </button>
          </div>
        </section>
      </div>
    )}

    <div style={{ marginTop: 24 }}>
        <a
          href="/sf-vault-k8m42x/dashboard"
          style={{ color: "#f5b82e", textDecoration: "none" }}
        >
          ← Back to Admin Dashboard
        </a>
      </div>
   </main>
  );
}
