// Ficha instantánea para el profesional (apartado 16, R04): lo que quiere hoy, primero.

import { useEffect, useState } from "react";
import { navigate } from "../../app/router";
import { useStore } from "../../app/store";
import { PermissionError } from "../../domain/permissions";
import { sessionCard, sessionPhotos } from "../../domain/queries";
import { formatDay, formatMoney, timePart } from "../../domain/time";
import { Icon } from "../../ui/Icon";
import { Avatar, Empty, Notice, PageHeader, PhotoArt, Sheet, StatusBadge } from "../../ui/common";
import { PreferenceChip } from "../../ui/product";

const MODE_LABEL = {
  repetir_ultimo: "Repetir el último",
  elegir_anterior: "Repetir un estilo anterior",
  subir_referencia: "Trae una referencia",
  quiero_cambiar: "Quiere cambiar",
  consultar_barbero: "Quiere consultarlo contigo",
};

export function SessionCardScreen({ id }: { id: string }) {
  const { state, actor, be, toast } = useStore();
  const [zoom, setZoom] = useState(false);
  const [prefLabel, setPrefLabel] = useState("");
  const [prefValue, setPrefValue] = useState("");

  let card: ReturnType<typeof sessionCard> = null;
  let denied = false;
  try {
    card = sessionCard(state, actor, id);
  } catch (e) {
    if (e instanceof PermissionError) denied = true;
    else throw e;
  }

  useEffect(() => {
    if (card?.prep && (!card.prep.seenByStaffAt || card.prep.changedAfterSeen) && card.appt.status !== "completada") be.markPreparationSeen(actor, id);
    // Solo al abrir la ficha.
  }, [id]);

  if (denied || !card)
    return (
      <div className="page">
        <PageHeader title="Ficha" backTo="/pro/hoy" />
        <Empty icon="lock" title={denied ? "No tienes acceso a esta ficha" : "Reserva no encontrada"}>
          {denied ? "Solo el profesional asignado y la gestión del establecimiento pueden abrirla." : undefined}
        </Empty>
      </div>
    );

  const { appt, customer, last, lastPhotos, daysSinceLast, prep, prepStyle, referencePhoto, preferences, feedback, history } = card;
  const lastFeedback = feedback.at(-1);
  const ss = customer.sessionStyle;
  const sessionPrefs = [ss.tranquila && "Sesión tranquila", ss.explicarCambios && "Explicar los cambios", ss.consultarAntes && "Consultar antes de cambios importantes"].filter(Boolean) as string[];
  const session = state.sessions.find((s) => s.appointmentId === appt.id);
  const refToShow = referencePhoto ?? lastPhotos[0];

  return (
    <div className="page">
      <PageHeader title="Ficha de sesión" backTo="/pro/hoy" />

      <div className="card row">
        <Avatar name={customer.name} hue={customer.hue} src={customer.photo} size="lg" />
        <div className="grow stack tight">
          <b style={{ fontSize: "var(--fs-lg)" }}>{customer.name}</b>
          <span className="small muted">
            {timePart(appt.start)}–{timePart(appt.end)} · {appt.services.map((s) => s.name).join(" + ")}
          </span>
          <span className="xs muted">
            {last ? `Última visita hace ${daysSinceLast} días · ${last.services.map((s) => s.name).join(" + ")}` : "Primera visita en este local"}
          </span>
          <span>
            <StatusBadge status={appt.status} />
          </span>
        </div>
      </div>

      {prep?.changedAfterSeen && (
        <Notice tone="warning" icon="alert">
          El cliente ha modificado la preparación después de que la vieras.
        </Notice>
      )}
      {appt.finishBy && <Notice icon="clock">Pide terminar antes de las {appt.finishBy} (petición, pendiente de confirmar).</Notice>}

      <section className="card stack" aria-label="Quiere hoy">
        <div className="row between">
          <b style={{ fontSize: "var(--fs-lg)" }}>Quiere hoy</b>
          {prep && <span className="badge">{MODE_LABEL[prep.mode]}</span>}
        </div>
        {prep ? (
          <div className="row" style={{ alignItems: "flex-start" }}>
            {refToShow && (
              <button onClick={() => setZoom(true)} aria-label="Ampliar referencia" style={{ border: 0, padding: 0, background: "none" }}>
                <PhotoArt hue={refToShow.hue} view={refToShow.view} img={refToShow.img} source={refToShow.source} label={null} style={{ width: 88, height: 110, borderRadius: 14 }} />
              </button>
            )}
            <div className="grow stack">
              {prepStyle && <span className="small">Referencia: {prepStyle.title}</span>}
              {prep.keep && (
                <div>
                  <div className="xs muted">Mantener</div>
                  <div style={{ fontWeight: 600 }}>{prep.keep}</div>
                </div>
              )}
              {prep.change && (
                <div>
                  <div className="xs muted">Cambiar</div>
                  <div style={{ fontWeight: 600 }}>{prep.change}</div>
                </div>
              )}
              {prep.note && <div className="small">«{prep.note}»</div>}
            </div>
          </div>
        ) : (
          <p className="small muted">No ha preparado la visita. {last ? "Puedes partir de su último servicio y preguntarle." : "Pregúntale qué busca."}</p>
        )}
      </section>

      {lastFeedback && (
        <section className="card tinted stack tight small">
          <b>De su última visita</b>
          {lastFeedback.liked && <span>Le gustó: {lastFeedback.liked}</span>}
          {lastFeedback.change && <span>Cambiaría: {lastFeedback.change}</span>}
          <span className="xs muted">Escrito por el cliente · {formatDay(lastFeedback.at)}</span>
        </section>
      )}

      {(sessionPrefs.length > 0 || preferences.length > 0) && (
        <section className="section">
          <div className="chips" style={{ flexWrap: "wrap" }}>
            {sessionPrefs.map((p) => (
              <span key={p} className="chip">
                {p}
              </span>
            ))}
            {preferences.map((p) => (
              <PreferenceChip key={p.id} pref={p} />
            ))}
          </div>
        </section>
      )}

      {session ? (
        <Notice tone="success" icon="check">
          Sesión cerrada · {formatMoney(session.finalCents)} · {session.photoIds.length} fotos. Pago {session.payment === "pendiente" ? "pendiente" : "registrado"}.
        </Notice>
      ) : (
        <div className="stack">
          {(appt.status === "confirmada" || appt.status === "modificada") && (
            <button
              className="btn primary block"
              onClick={() => {
                const r = be.checkIn(actor, { appointmentId: appt.id });
                toast(r.ok ? (r.status === "registrado" ? "Llegada registrada" : "Ya estaba registrada") : r.message);
              }}
            >
              <Icon name="check" size={18} /> Registrar llegada (verificada en persona)
            </button>
          )}
          {appt.status === "llegada" && (
            <button className="btn outline block" onClick={() => be.startService(actor, appt.id)}>
              <Icon name="scissors" size={18} /> Empezar servicio
            </button>
          )}
          {(appt.status === "llegada" || appt.status === "en_atencion") && (
            <button className="btn primary block" onClick={() => navigate(`/pro/finalizar/${appt.id}`)}>
              Finalizar sesión
            </button>
          )}
          {(appt.status === "confirmada" || appt.status === "modificada") && (
            <button className="btn ghost sm" onClick={() => be.markNoShow(actor, appt.id)}>
              Marcar ausencia
            </button>
          )}
        </div>
      )}

      <details className="card flat">
        <summary>
          <b>Historial en este local</b> <span className="muted small">({history.length} visitas)</span>
        </summary>
        <div className="stack" style={{ marginTop: 12 }}>
          {history.slice(0, 6).map((h) => {
            const photos = sessionPhotos(state, h);
            return (
              <div key={h.id} className="row">
                {photos[0] ? (
                  <PhotoArt hue={photos[0].hue} view={photos[0].view} img={photos[0].img} style={{ width: 44, height: 56, borderRadius: 10, flexShrink: 0 }} />
                ) : (
                  <span className="photo" style={{ width: 44, height: 56, borderRadius: 10, flexShrink: 0 }} />
                )}
                <div className="grow small">
                  <b>{h.services.map((s) => s.name).join(" + ")}</b>
                  <div className="xs muted">
                    {formatDay(h.completedAt)} · {state.staff.find((s) => s.id === h.staffId)?.name}
                  </div>
                  {h.technicalNote && <div className="xs">{h.technicalNote}</div>}
                </div>
              </div>
            );
          })}
          <p className="xs muted">Solo ves visitas de este establecimiento. Los gastos globales del cliente no se muestran aquí.</p>
        </div>
      </details>

      <details className="card flat">
        <summary>
          <b>Proponer una preferencia</b>
        </summary>
        <div className="stack" style={{ marginTop: 12 }}>
          <div className="row">
            <input className="input" placeholder="Ej.: Laterales" value={prefLabel} onChange={(e) => setPrefLabel(e.target.value)} aria-label="Preferencia" />
            <input className="input" placeholder="Ej.: Máquina 2" value={prefValue} onChange={(e) => setPrefValue(e.target.value)} aria-label="Valor" />
          </div>
          <button
            className="btn outline sm"
            disabled={!prefLabel.trim() || !prefValue.trim()}
            onClick={() => {
              be.proposePreference(actor, customer.id, prefLabel.trim(), prefValue.trim());
              setPrefLabel("");
              setPrefValue("");
              toast("Propuesta enviada. El cliente decide si la guarda.");
            }}
          >
            Proponer al cliente
          </button>
        </div>
      </details>

      {zoom && refToShow && (
        <Sheet title="Referencia" onClose={() => setZoom(false)}>
          <PhotoArt hue={refToShow.hue} view={refToShow.view} img={refToShow.img} source={refToShow.source} style={{ aspectRatio: "4 / 5", borderRadius: "var(--r-lg)" }} />
        </Sheet>
      )}
    </div>
  );
}
