"use client";

import * as React from "react";

type Locale = "es" | "eu";
type Messages = Record<string, string>;

const messages: Record<Locale, Messages> = {
  es: {
    "app.title": "MediBilbao Salud",
    "auth.login": "Iniciar sesión",
    "auth.signup": "Crear cuenta",
    "auth.email": "Email",
    "auth.password": "Contraseña",
    "auth.forgot": "¿Olvidaste tu contraseña?",
    "auth.reset": "Restablecer contraseña",
    "auth.checkEmail": "Revisa tu email para confirmar tu cuenta.",
    "common.continue": "Continuar",
    "common.save": "Guardar",
    "common.cancel": "Cancelar",
    "common.signOut": "Cerrar sesión",
    "settings.title": "Ajustes",
    "settings.language": "Idioma",
    "settings.es": "Español",
    "settings.eu": "Euskera",
  },
  eu: {
    "app.title": "MediBilbao Osasuna",
    "auth.login": "Saioa hasi",
    "auth.signup": "Kontua sortu",
    "auth.email": "Emaila",
    "auth.password": "Pasahitza",
    "auth.forgot": "Pasahitza ahaztu duzu?",
    "auth.reset": "Pasahitza berrezarri",
    "auth.checkEmail": "Egiaztatu zure emaila kontua baieztatzeko.",
    "common.continue": "Jarraitu",
    "common.save": "Gorde",
    "common.cancel": "Utzi",
    "common.signOut": "Saioa itxi",
    "settings.title": "Ezarpenak",
    "settings.language": "Hizkuntza",
    "settings.es": "Gaztelania",
    "settings.eu": "Euskara",
  },
};

const LocaleContext = React.createContext<{
  locale: Locale;
  t: (key: string) => string;
} | null>(null);

export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  const [locale, setLocale] = React.useState<Locale>(initialLocale);

  React.useEffect(() => {
    setLocale(initialLocale);
  }, [initialLocale]);

  const value = React.useMemo(() => {
    const table = messages[locale] ?? messages.es;
    const t = (key: string) => table[key] ?? messages.es[key] ?? key;
    return { locale, t };
  }, [locale]);

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useT() {
  const ctx = React.useContext(LocaleContext);
  if (!ctx) throw new Error("useT must be used within LocaleProvider");
  return ctx;
}
