(() => {
  if (window.CONFIG) return;

  const host = window.location.hostname || "127.0.0.1";
  const defaultBackend = `${host}:5000`;

  window.CONFIG = {
    SERVER_PC_IP: defaultBackend,
    MACRO_PC_IP: ""
  };
})();
