import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type LanguageCode = "en" | "es" | "fr" | "de" | "pt";
export const UI_LANGUAGE_STORAGE_KEY = "ui_language";
export const LANGUAGE_OPTIONS: Array<{ value: LanguageCode; label: string; flag: string }> = [
  { value: "en", label: "English", flag: "🇺🇸" },
  { value: "es", label: "Espanol", flag: "🇪🇸" },
  { value: "fr", label: "Francais", flag: "🇫🇷" },
  { value: "de", label: "Deutsch", flag: "🇩🇪" },
  { value: "pt", label: "Portugues", flag: "🇵🇹" }
];

type Dictionary = Record<string, string>;

const dictionaries: Record<LanguageCode, Dictionary> = {
  en: {
    nav_home: "Home",
    nav_portfolio: "Portfolio",
    nav_deposit: "Deposit",
    nav_withdraw: "Withdraw",
    nav_leaderboard: "Leaderboard",
    nav_referrals: "Referrals",
    nav_admin: "Admin",
    nav_intelligence: "Intelligence",
    nav_login: "Login",
    nav_register: "Register",
    nav_settings: "Settings",
    nav_profile: "Profile",
    nav_logout: "Logout",
    nav_notifications: "Notifications",
    settings_title: "Settings",
    settings_account: "Account",
    settings_security: "Security",
    settings_wallet: "Wallet",
    settings_notifications: "Notifications",
    settings_preferences: "Preferences",
    settings_support: "Support",
    settings_danger_zone: "Danger Zone",
    settings_change_password: "Change Password",
    settings_save_address: "Save Address",
    settings_contact_support: "Contact Support",
    settings_delete_account: "Delete Account",
    settings_language_updated: "Language preference updated."
  },
  es: {
    nav_home: "Inicio",
    nav_portfolio: "Portafolio",
    nav_deposit: "Depositar",
    nav_withdraw: "Retirar",
    nav_leaderboard: "Clasificacion",
    nav_referrals: "Referidos",
    nav_admin: "Admin",
    nav_intelligence: "Inteligencia",
    nav_login: "Iniciar sesion",
    nav_register: "Registrarse",
    nav_settings: "Configuracion",
    nav_profile: "Perfil",
    nav_logout: "Cerrar sesion",
    nav_notifications: "Notificaciones",
    settings_title: "Configuracion",
    settings_account: "Cuenta",
    settings_security: "Seguridad",
    settings_wallet: "Billetera",
    settings_notifications: "Notificaciones",
    settings_preferences: "Preferencias",
    settings_support: "Soporte",
    settings_danger_zone: "Zona de riesgo",
    settings_change_password: "Cambiar contrasena",
    settings_save_address: "Guardar direccion",
    settings_contact_support: "Contactar soporte",
    settings_delete_account: "Eliminar cuenta",
    settings_language_updated: "Preferencia de idioma actualizada."
  },
  fr: {
    nav_home: "Accueil",
    nav_portfolio: "Portefeuille",
    nav_deposit: "Depot",
    nav_withdraw: "Retrait",
    nav_leaderboard: "Classement",
    nav_referrals: "Parrainages",
    nav_admin: "Admin",
    nav_intelligence: "Intelligence",
    nav_login: "Connexion",
    nav_register: "Inscription",
    nav_settings: "Parametres",
    nav_profile: "Profil",
    nav_logout: "Deconnexion",
    nav_notifications: "Notifications",
    settings_title: "Parametres",
    settings_account: "Compte",
    settings_security: "Securite",
    settings_wallet: "Portefeuille",
    settings_notifications: "Notifications",
    settings_preferences: "Preferences",
    settings_support: "Support",
    settings_danger_zone: "Zone dangereuse",
    settings_change_password: "Changer le mot de passe",
    settings_save_address: "Enregistrer l'adresse",
    settings_contact_support: "Contacter le support",
    settings_delete_account: "Supprimer le compte",
    settings_language_updated: "Preference de langue mise a jour."
  },
  de: {
    nav_home: "Startseite",
    nav_portfolio: "Portfolio",
    nav_deposit: "Einzahlen",
    nav_withdraw: "Auszahlen",
    nav_leaderboard: "Rangliste",
    nav_referrals: "Empfehlungen",
    nav_admin: "Admin",
    nav_intelligence: "Intelligenz",
    nav_login: "Anmelden",
    nav_register: "Registrieren",
    nav_settings: "Einstellungen",
    nav_profile: "Profil",
    nav_logout: "Abmelden",
    nav_notifications: "Benachrichtigungen",
    settings_title: "Einstellungen",
    settings_account: "Konto",
    settings_security: "Sicherheit",
    settings_wallet: "Wallet",
    settings_notifications: "Benachrichtigungen",
    settings_preferences: "Einstellungen",
    settings_support: "Support",
    settings_danger_zone: "Gefahrenbereich",
    settings_change_password: "Passwort andern",
    settings_save_address: "Adresse speichern",
    settings_contact_support: "Support kontaktieren",
    settings_delete_account: "Konto loschen",
    settings_language_updated: "Spracheinstellung aktualisiert."
  },
  pt: {
    nav_home: "Inicio",
    nav_portfolio: "Portfolio",
    nav_deposit: "Depositar",
    nav_withdraw: "Sacar",
    nav_leaderboard: "Ranking",
    nav_referrals: "Indicacoes",
    nav_admin: "Admin",
    nav_intelligence: "Inteligencia",
    nav_login: "Entrar",
    nav_register: "Registrar",
    nav_settings: "Configuracoes",
    nav_profile: "Perfil",
    nav_logout: "Sair",
    nav_notifications: "Notificacoes",
    settings_title: "Configuracoes",
    settings_account: "Conta",
    settings_security: "Seguranca",
    settings_wallet: "Carteira",
    settings_notifications: "Notificacoes",
    settings_preferences: "Preferencias",
    settings_support: "Suporte",
    settings_danger_zone: "Zona de risco",
    settings_change_password: "Alterar senha",
    settings_save_address: "Salvar endereco",
    settings_contact_support: "Contatar suporte",
    settings_delete_account: "Excluir conta",
    settings_language_updated: "Preferencia de idioma atualizada."
  }
};

interface I18nContextValue {
  language: LanguageCode;
  setLanguage: (language: LanguageCode) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);
const originalTextNodes = new WeakMap<Text, string>();
const globalPhraseDictionary: Record<LanguageCode, Record<string, string>> = {
  en: {},
  es: {
    Home: "Inicio",
    Portfolio: "Portafolio",
    Deposit: "Depositar",
    Withdraw: "Retirar",
    Leaderboard: "Clasificacion",
    Referrals: "Referidos",
    Login: "Iniciar sesion",
    Register: "Registrarse",
    Settings: "Configuracion",
    "Forgot password?": "Olvidaste tu contrasena?",
    "Create account": "Crear cuenta",
    "Community stats": "Estadisticas de la comunidad",
    "Total deposits processed": "Depositos totales procesados",
    "Active today": "Activos hoy",
    "Top level reached": "Nivel mas alto alcanzado",
    "Join the Growing Community": "Unete a la comunidad en crecimiento",
    "View Dashboard": "Ver panel",
    "Contact Support": "Contactar soporte"
  },
  fr: {
    Home: "Accueil",
    Portfolio: "Portefeuille",
    Deposit: "Depot",
    Withdraw: "Retrait",
    Leaderboard: "Classement",
    Referrals: "Parrainages",
    Login: "Connexion",
    Register: "Inscription",
    Settings: "Parametres",
    "Forgot password?": "Mot de passe oublie ?",
    "Create account": "Creer un compte",
    "Community stats": "Statistiques de la communaute",
    "Total deposits processed": "Depots totaux traites",
    "Active today": "Actifs aujourd'hui",
    "Top level reached": "Niveau maximum atteint",
    "Join the Growing Community": "Rejoignez la communaute en croissance",
    "View Dashboard": "Voir le tableau de bord",
    "Contact Support": "Contacter le support"
  },
  de: {
    Home: "Startseite",
    Portfolio: "Portfolio",
    Deposit: "Einzahlen",
    Withdraw: "Auszahlen",
    Leaderboard: "Rangliste",
    Referrals: "Empfehlungen",
    Login: "Anmelden",
    Register: "Registrieren",
    Settings: "Einstellungen",
    "Forgot password?": "Passwort vergessen?",
    "Create account": "Konto erstellen",
    "Community stats": "Community-Statistiken",
    "Total deposits processed": "Verarbeitete Einzahlungen gesamt",
    "Active today": "Heute aktiv",
    "Top level reached": "Hochstes erreichtes Level",
    "Join the Growing Community": "Der wachsenden Community beitreten",
    "View Dashboard": "Dashboard anzeigen",
    "Contact Support": "Support kontaktieren"
  },
  pt: {
    Home: "Inicio",
    Portfolio: "Portfolio",
    Deposit: "Depositar",
    Withdraw: "Sacar",
    Leaderboard: "Ranking",
    Referrals: "Indicacoes",
    Login: "Entrar",
    Register: "Registrar",
    Settings: "Configuracoes",
    "Forgot password?": "Esqueceu a senha?",
    "Create account": "Criar conta",
    "Community stats": "Estatisticas da comunidade",
    "Total deposits processed": "Depositos totais processados",
    "Active today": "Ativos hoje",
    "Top level reached": "Nivel maximo alcancado",
    "Join the Growing Community": "Junte-se a comunidade em crescimento",
    "View Dashboard": "Ver painel",
    "Contact Support": "Contatar suporte"
  }
};

function isLanguageCode(value: string | null): value is LanguageCode {
  return value === "en" || value === "es" || value === "fr" || value === "de" || value === "pt";
}

function getStoredLanguage(): LanguageCode {
  if (typeof window === "undefined") {
    return "en";
  }
  const raw = window.localStorage.getItem(UI_LANGUAGE_STORAGE_KEY);
  if (isLanguageCode(raw)) {
    return raw;
  }
  return "en";
}

function applyLanguageToDom(language: LanguageCode) {
  if (typeof document === "undefined") {
    return;
  }
  document.documentElement.lang = language;

  const translations = globalPhraseDictionary[language];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node: Node | null = walker.nextNode();
  while (node) {
    const textNode = node as Text;
    const parent = textNode.parentElement;
    if (!parent || ["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "OPTION"].includes(parent.tagName)) {
      node = walker.nextNode();
      continue;
    }

    const current = textNode.nodeValue ?? "";
    if (!current.trim()) {
      node = walker.nextNode();
      continue;
    }
    if (!originalTextNodes.has(textNode)) {
      originalTextNodes.set(textNode, current);
    }
    const original = originalTextNodes.get(textNode) ?? current;
    const leading = original.match(/^\s*/)?.[0] ?? "";
    const trailing = original.match(/\s*$/)?.[0] ?? "";
    const core = original.trim();
    const translated = language === "en" ? core : translations[core];
    textNode.nodeValue = `${leading}${translated ?? core}${trailing}`;
    node = walker.nextNode();
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>(getStoredLanguage);

  const setLanguage = useCallback((nextLanguage: LanguageCode) => {
    setLanguageState(nextLanguage);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, nextLanguage);
      window.dispatchEvent(new CustomEvent("ui-language-changed", { detail: nextLanguage }));
    }
    applyLanguageToDom(nextLanguage);
  }, []);

  useEffect(() => {
    applyLanguageToDom(language);
    window.localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, language);
  }, [language]);

  useEffect(() => {
    const onLanguageChanged = (event: Event) => {
      const detail = (event as CustomEvent<LanguageCode>).detail;
      if (isLanguageCode(detail)) {
        setLanguageState(detail);
      }
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== UI_LANGUAGE_STORAGE_KEY) {
        return;
      }
      if (isLanguageCode(event.newValue)) {
        setLanguageState(event.newValue);
      }
    };
    window.addEventListener("ui-language-changed", onLanguageChanged as EventListener);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("ui-language-changed", onLanguageChanged as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      setLanguage,
      t: (key: string) => dictionaries[language][key] || dictionaries.en[key] || key
    }),
    [language, setLanguage]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
}

