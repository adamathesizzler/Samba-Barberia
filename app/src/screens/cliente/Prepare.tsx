// Preparar mi visita + Esto sí / Esto no (apartados 7 y 15). Se guarda en esta cita concreta.

import { useState } from "react";
import { navigate } from "../../app/router";
import { useStore } from "../../app/store";
import { customerSessions } from "../../domain/queries";
import { formatDay, timePart } from "../../domain/time";
import type { PreparationMode } from "../../domain/types";
import { Icon } from "../../ui/Icon";
import { Empty, Notice, PageHeader, PhotoArt, SimBadge } from "../../ui/common";

export function Prepare({ id }: { id: string }) {
  const { state, actor, be, toast } = useStore();
  const a = state.appointments.find((x) => x.id === id);
  const me = actor.kind === "cliente" ? actor.customerId : "";
  const existing = state.preparations.find((p) => p.appointmentId === id);
  const entries = state.styleEntries.filter((e) => e.customerId === me);
  const sessions = customerSessions(state, me);
  const lastEntry = sessions[0] && entries.find((e) => e.sessionId === sessions[0].id);

  const hasHistory = entries.length > 0;
  const [mode, setMode] = useState<PreparationMode>(existing?.mode ?? (hasHistory ? "repetir_ultimo" : "subir_referencia"));
  const [styleEntryId, setStyleEntryId] = useState(existing?.styleEntryId ?? lastEntry?.id);
  const [referencePhotoId, setRef] = useState(existing?.referencePhotoId);
  const [keep, setKeep] = useState(existing?.keep ?? "");
  const [change, setChange] = useState(existing?.change ?? "");
  const [note, setNote] = useState(existing?.note ?? "");
  const [uploadError, setUploadError] = useState<string | null>(null);

  if (!a || a.customerId !== me)
    return (
      <div className="page">
        <PageHeader title="Preparar visita" backTo="/cliente/inicio" />
        <Empty icon="lock" title="No encontramos esta reserva" />
      </div>
    );
  const editable = ["confirmada", "modificada", "llegada"].includes(a.status);
  const staff = state.staff.find((s) => s.id === a.staffId)!;
  const lastFeedback = sessions[0] && state.feedback.filter((f) => f.sessionId === sessions[0].id && f.author === "cliente").at(-1);

  const modes: { key: PreparationMode; label: string; show: boolean }[] = [
    { key: "repetir_ultimo", label: "Repetir último look", show: !!lastEntry },
    { key: "elegir_anterior", label: "Elegir uno anterior", show: entries.length > 1 },
    { key: "subir_referencia", label: "Subir referencia", show: true },
    { key: "quiero_cambiar", label: "Quiero cambiar", show: true },
    { key: "consultar_barbero", label: "Lo hablo con mi barbero", show: true },
  ];

  const save = () => {
    const r = be.savePreparation(actor, a.id, {
      mode,
      styleEntryId: mode === "repetir_ultimo" ? lastEntry?.id : mode === "elegir_anterior" ? styleEntryId : undefined,
      referencePhotoId: mode === "subir_referencia" ? referencePhotoId : undefined,
      keep,
      change,
      note,
    });
    if (!r.ok) return toast(r.message);
    toast(existing?.seenByStaffAt ? `Guardado. ${staff.name} verá que has cambiado la preparación.` : "Preparación guardada");
    navigate(`/cliente/cita/${a.id}`);
  };

  const chosen = mode === "repetir_ultimo" ? lastEntry : mode === "elegir_anterior" ? entries.find((e) => e.id === styleEntryId) : undefined;
  const chosenPhoto = chosen?.coverPhotoId ? state.photos.find((p) => p.id === chosen.coverPhotoId) : undefined;
  const refPhoto = referencePhotoId ? state.photos.find((p) => p.id === referencePhotoId) : undefined;

  return (
    <div className="page">
      <PageHeader title="Preparar mi visita" backTo={`/cliente/cita/${a.id}`} />
      <p className="small muted">
        Para tu cita del {formatDay(a.start)} a las {timePart(a.start)} con {staff.name}. Es opcional y solo se aplica a esta reserva.
      </p>
      {!editable && <Notice tone="warning">Esta cita ya no admite cambios en la preparación.</Notice>}
      {existing?.seenByStaffAt && <Notice icon="info">{staff.name} ya ha visto tu preparación. Si la cambias, se le avisará.</Notice>}

      <div className="chips" role="radiogroup" aria-label="Qué quieres hoy" style={{ flexWrap: "wrap" }}>
        {modes
          .filter((m) => m.show)
          .map((m) => (
            <button key={m.key} className="chip" role="radio" aria-checked={mode === m.key} onClick={() => setMode(m.key)}>
              {m.label}
            </button>
          ))}
        <button className="chip" onClick={() => navigate("/cliente/style-ai")}>
          <Icon name="sparkle" size={14} /> Style AI <SimBadge>Fase 3</SimBadge>
        </button>
      </div>

      {mode === "elegir_anterior" && (
        <div className="grid-photos" role="radiogroup" aria-label="Estilos anteriores">
          {entries
            .filter((e) => e.coverPhotoId)
            .slice(0, 12)
            .map((e) => {
              const p = state.photos.find((x) => x.id === e.coverPhotoId)!;
              return (
                <button
                  key={e.id}
                  role="radio"
                  aria-checked={styleEntryId === e.id}
                  aria-label={e.title}
                  onClick={() => setStyleEntryId(e.id)}
                  style={{ outline: styleEntryId === e.id ? "3px solid var(--selected)" : undefined, outlineOffset: -3 }}
                >
                  <PhotoArt hue={p.hue} view={p.view} img={p.img} label={null} style={{ width: "100%", height: "100%" }} />
                </button>
              );
            })}
        </div>
      )}

      {chosen && (
        <div className="card row">
          {chosenPhoto && <PhotoArt hue={chosenPhoto.hue} view={chosenPhoto.view} img={chosenPhoto.img} label={null} style={{ width: 64, height: 80, borderRadius: 12 }} />}
          <div className="grow">
            <b>{chosen.title}</b>
            <div className="xs muted">{formatDay(state.sessions.find((s) => s.id === chosen.sessionId)!.completedAt)}</div>
          </div>
        </div>
      )}

      {mode === "subir_referencia" && (
        <div className="card stack">
          {refPhoto ? (
            <div className="row">
              <PhotoArt hue={refPhoto.hue} view={refPhoto.view} img={refPhoto.img} source={refPhoto.source} style={{ width: 64, height: 80, borderRadius: 12 }} />
              <span className="grow small">Referencia añadida para esta cita.</span>
              <button className="btn ghost sm" onClick={() => setRef(undefined)}>
                Quitar
              </button>
            </div>
          ) : (
            <>
              <span className="small">Sube una imagen de lo que te gustaría. Se marcará como referencia externa, no como trabajo del local.</span>
              <div className="row">
                <button
                  className="btn outline grow"
                  onClick={() => {
                    const r = be.uploadPhoto(actor, { appointmentId: a.id, view: "frontal", source: "referencia_externa", img: "look-quiff" });
                    if (r.ok) {
                      setRef(r.photo.id);
                      setUploadError(null);
                    }
                  }}
                >
                  <Icon name="upload" size={18} /> Elegir imagen <SimBadge>demo</SimBadge>
                </button>
              </div>
              <button
                className="btn ghost sm"
                onClick={() => {
                  const r = be.uploadPhoto(actor, { appointmentId: a.id, view: "frontal", source: "referencia_externa", simulateFailure: true });
                  if (!r.ok) setUploadError(r.message);
                }}
              >
                Simular fallo de subida
              </button>
              {uploadError && <Notice tone="danger">{uploadError}</Notice>}
            </>
          )}
        </div>
      )}

      {lastFeedback && (
        <Notice icon="history">
          La última vez dijiste: «{lastFeedback.change || lastFeedback.liked}». ¿Sigue valiendo?{" "}
          <button className="btn ghost sm" onClick={() => setChange(lastFeedback.change)}>
            Usarlo
          </button>
        </Notice>
      )}

      <label className="field">
        <span className="label">Esto sí: qué mantener</span>
        <textarea className="textarea" value={keep} onChange={(e) => setKeep(e.target.value)} placeholder="Ej.: la longitud de arriba y la barba" />
      </label>
      <label className="field">
        <span className="label">Esto no: qué cambiar</span>
        <textarea className="textarea" value={change} onChange={(e) => setChange(e.target.value)} placeholder="Ej.: no subir tanto el degradado" />
      </label>
      <label className="field">
        <span className="label">Algo más para {staff.name}</span>
        <textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} />
        <span className="hint">Solo para esta cita. No se convierte en una preferencia permanente.</span>
      </label>

      <button className="btn primary block" onClick={save} disabled={!editable}>
        Guardar preparación
      </button>
      <p className="xs muted">
        Preparar no cambia servicios, duración ni precio. Si hace falta otro servicio, {staff.name} te lo confirmará.
      </p>
    </div>
  );
}
