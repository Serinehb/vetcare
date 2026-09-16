import { NextRequest, NextResponse } from "next/server";
import {
  applySyncMutation,
  readSyncState,
  type SyncMutation,
} from "@/lib/db-fallback";

/* ─── GET /api/sync ───
   État partagé complet (conversations, marqueurs "vu", notifications,
   rendez-vous, stagiaires). Exécute aussi les rappels automatiques 24 h
   côté serveur : chaque appareil qui se synchronise déclenche le check,
   mais le message de rappel n'est déposé qu'UNE seule fois par RDV
   (garde remindedAppointments côté store). C'est ce qui rend le rappel
   fiable même quand aucun admin n'a ouvert son tableau de bord. */
export async function GET() {
  try {
    const state = readSyncState();
    return NextResponse.json(state, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "sync indisponible" },
      { status: 500 }
    );
  }
}

/* ─── POST /api/sync ───
   Une mutation à la fois (message, vu, notification, RDV, stagiaire…).
   Toutes les mutations sont idempotentes : renvoyer le même POST ne
   duplique rien, ce qui rend la synchronisation multi-appareils sûre. */
export async function POST(req: NextRequest) {
  try {
    const mutation = (await req.json()) as SyncMutation;
    if (!mutation || typeof mutation.type !== "string") {
      return NextResponse.json({ ok: false, error: "mutation invalide" }, { status: 400 });
    }
    applySyncMutation(mutation);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
