"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Loader2, Target, Trophy } from "lucide-react";
import { fetchChallengeFeed, enrollInChallenge, completeMission } from "@/lib/services/challenges";
import type { ChallengePayload, PatientMission } from "@/lib/types/engagement";
import { trackEvent } from "@/lib/telemetry/client";
import { Topbar } from "@/components/ui/Topbar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function PatientChallengesPage() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [challenges, setChallenges] = React.useState<ChallengePayload[]>([]);
  const [missions, setMissions] = React.useState<PatientMission[]>([]);
  const [busyChallengeId, setBusyChallengeId] = React.useState<string | null>(null);
  const [busyMissionId, setBusyMissionId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const feed = await fetchChallengeFeed();
      setChallenges(feed.challenges);
      setMissions(feed.missions);
      trackEvent({
        schemaVersion: 2,
        eventName: "challenge_view_feed",
        source: "web",
        context: { challenges: feed.challenges.length, missions: feed.missions.length },
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo cargar retos.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function enroll(challengeId: string) {
    setBusyChallengeId(challengeId);
    setError(null);
    try {
      await enrollInChallenge(challengeId);
      trackEvent({
        schemaVersion: 2,
        eventName: "challenge_enroll",
        source: "web",
        context: { challengeId },
      });
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo unir al reto.");
    } finally {
      setBusyChallengeId(null);
    }
  }

  async function completeDailyMission(mission: PatientMission) {
    setBusyMissionId(mission.id);
    setError(null);
    try {
      await completeMission({
        missionId: mission.id,
        completionKey: mission.mission_key,
        metadata: { source: "challenges_page" },
      });
      trackEvent({
        schemaVersion: 2,
        eventName: "mission_complete",
        source: "web",
        context: { missionKey: mission.mission_key },
      });
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo completar la mision.");
    } finally {
      setBusyMissionId(null);
    }
  }

  return (
    <div className="pb-24">
      <Topbar title="Retos privados" subtitle="Gamificacion clinica sin comunidad publica" />
      <div className="space-y-4 px-4 py-4">
        {error ? (
          <Card className="border-[var(--danger)]/30 bg-red-50">
            <p className="text-sm text-[var(--danger)]">{error}</p>
          </Card>
        ) : null}

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-[var(--text)]">Retos de tu nutricionista</div>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Participacion privada por cohorte.</p>
            </div>
            <Trophy className="h-4 w-4 text-[var(--warning)]" />
          </div>
          <div className="mt-3 space-y-2">
            {loading ? (
              <p className="text-sm text-[var(--text-muted)]">Cargando retos...</p>
            ) : challenges.length ? (
              challenges.map((challenge) => (
                <motion.div
                  key={challenge.challengeId}
                  whileHover={{ y: -2 }}
                  className="rounded-[var(--radius-sm)] border border-[var(--line)] bg-white p-3"
                >
                  <p className="text-sm font-semibold text-[var(--text)]">{challenge.title}</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">{challenge.description}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-[var(--text-muted)]">
                      Estado: {challenge.status} · Progreso: {challenge.progress}
                    </span>
                    {challenge.enrolled ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">Unido</span>
                    ) : (
                      <Button
                        variant="secondary"
                        onClick={() => enroll(challenge.challengeId)}
                        disabled={busyChallengeId === challenge.challengeId}
                      >
                        {busyChallengeId === challenge.challengeId ? <Loader2 className="h-4 w-4 animate-spin" /> : "Unirme"}
                      </Button>
                    )}
                  </div>
                </motion.div>
              ))
            ) : (
              <p className="text-sm text-[var(--text-muted)]">No hay retos activos ahora mismo.</p>
            )}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-[var(--text)]">Misiones de hoy</div>
              <p className="mt-1 text-xs text-[var(--text-muted)]">3 micro acciones para reforzar adherencia.</p>
            </div>
            <Target className="h-4 w-4 text-[var(--accent)]" />
          </div>
          <div className="mt-3 space-y-2">
            {missions.length ? (
              missions.map((mission) => (
                <div key={mission.id} className="flex items-center justify-between rounded-[var(--radius-sm)] border border-[var(--line)] bg-white px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold text-[var(--text)]">{mission.title}</p>
                    <p className="text-xs text-[var(--text-muted)]">{mission.completed ? "Completada" : "Pendiente"}</p>
                  </div>
                  <Button
                    variant={mission.completed ? "secondary" : "primary"}
                    disabled={mission.completed || busyMissionId === mission.id}
                    onClick={() => completeDailyMission(mission)}
                  >
                    {busyMissionId === mission.id ? <Loader2 className="h-4 w-4 animate-spin" /> : mission.completed ? "Hecha" : "Completar"}
                  </Button>
                </div>
              ))
            ) : (
              <p className="text-sm text-[var(--text-muted)]">No hay misiones para hoy.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
