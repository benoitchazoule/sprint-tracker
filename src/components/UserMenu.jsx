import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Moon, Sun, LogOut, ChevronRight } from 'lucide-react';

const AVATAR_COLORS = ['#4f46e5', '#7c3aed', '#6366f1', '#8b5cf6', '#4338ca'];

function getAvatarColor(email) {
  return AVATAR_COLORS[email.charCodeAt(0) % AVATAR_COLORS.length];
}

export default function UserMenu({ user, theme, locale, locales, onToggleTheme, onSetLocale, onLogout, t, collapsed }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState({});
  const wrapperRef = useRef(null);
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const sidebar = triggerRef.current.closest('.sidebar');
    const sidebarRight = sidebar ? sidebar.getBoundingClientRect().right : rect.right;
    setPopoverStyle({
      position: 'fixed',
      bottom: window.innerHeight - rect.bottom,
      left: sidebarRight + 8,
    });
  }, []);

  const closePopover = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setIsOpen(false);
      setIsVisible(false);
      setIsClosing(false);
    }, 150);
  }, []);

  const openPopover = useCallback(() => {
    setIsOpen(true);
    requestAnimationFrame(() => setIsVisible(true));
  }, []);

  const togglePopover = useCallback(() => {
    if (isOpen && !isClosing) {
      closePopover();
    } else if (!isOpen) {
      openPopover();
    }
  }, [isOpen, isClosing, closePopover, openPopover]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target) &&
          popoverRef.current && !popoverRef.current.contains(e.target)) {
        closePopover();
      }
    }
    if (isOpen) {
      updatePosition();
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, updatePosition, closePopover]);

  const email = user?.email || '';
  const initial = email.charAt(0).toUpperCase();
  const avatarColor = getAvatarColor(email);

  return (
    <div className="user-menu-wrapper" ref={wrapperRef}>
      <button
        ref={triggerRef}
        className="user-menu-trigger"
        onClick={togglePopover}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <span className="user-avatar" style={{ background: avatarColor }}>{initial}</span>
        {!collapsed && (
          <>
            <span className="user-menu-email">{email}</span>
            <ChevronRight size={14} style={{ flexShrink: 0, opacity: 0.5, transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
          </>
        )}
      </button>

      {isOpen && (
        <div className={`user-menu-popover ${isVisible && !isClosing ? 'user-menu-popover-open' : 'user-menu-popover-closed'}`} ref={popoverRef} style={popoverStyle}>
          <div className="user-menu-section-label">{t('menu.language') || 'Language'}</div>
          <div className="user-menu-locales">
            {locales.map((loc) => (
              <button
                key={loc.code}
                className={`user-menu-locale-btn ${locale === loc.code ? 'active' : ''}`}
                onClick={() => { onSetLocale(loc.code); }}
              >
                {loc.label}
              </button>
            ))}
          </div>

          <div className="user-menu-divider" />

          <button className="user-menu-item" onClick={() => { onToggleTheme(); }}>
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            <span>{theme === 'light' ? t('nav.darkMode') : t('nav.lightMode')}</span>
          </button>

          <div className="user-menu-divider" />

          <button className="user-menu-item user-menu-logout" onClick={() => { onLogout(); closePopover(); }}>
            <LogOut size={16} />
            <span>{t('menu.signOut') || t('auth.logout')}</span>
          </button>
        </div>
      )}
    </div>
  );
}
