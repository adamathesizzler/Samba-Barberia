// Bienvenida (pantalla 01, R13): foto protagonista, titular grande y un único botón para empezar.

import { navigate } from "../../app/router";
import { Icon } from "../../ui/Icon";
import { PhotoArt } from "../../ui/common";

const KEY = "samba.welcome.seen";

export function welcomeSeen(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    // Sin almacenamiento no se insiste: la bienvenida sigue en Ajustes.
    return true;
  }
}

export function Welcome() {
  const start = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* sin persistencia */
    }
    navigate("/cliente/inicio");
  };
  return (
    <div className="welcome">
      <PhotoArt hue={24} view="lateral_der" label="Foto demo" />
      <div className="brand">
        <Icon name="scissors" size={18} strokeWidth={2.2} /> Samba
      </div>
      <p className="headline">Tu estilo, recordado.</p>
      <div className="panel glass">
        <h2>Tu barbero sabe cómo te gusta</h2>
        <p className="small muted" style={{ maxWidth: 300 }}>
          Reserva, prepara tu visita y guarda cada resultado para repetirlo o cambiarlo la próxima vez.
        </p>
        <button className="cta-arrow" onClick={start}>
          <span className="knob">
            <Icon name="arrowRight" size={22} strokeWidth={2.2} />
          </span>
          <span>Empezar</span>
        </button>
        <span className="xs muted">Prototipo con datos ficticios</span>
      </div>
    </div>
  );
}
