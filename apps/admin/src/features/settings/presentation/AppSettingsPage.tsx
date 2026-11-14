import { useState, type ChangeEvent } from 'react';
import { Camera, RotateCcw, Settings2, Type, UserRound } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { firestore, storage } from '../../../core/firebase/firebaseConfig';
import type { AdminPage } from '../../dashboard/presentation/AdminShell';
import { fontFamilies, fontScales, type AppFontFamily, type AppFontScale } from '../appAppearance';

type MenuSection = {
  label: string;
  items: Array<{ key: AdminPage; label: string }>;
};

type Props = {
  email: string;
  error: string;
  fontFamily: AppFontFamily;
  fontScale: AppFontScale;
  hiddenPages: string[];
  menuSections: MenuSection[];
  name: string;
  onAppearanceChange: (family: AppFontFamily, scale: AppFontScale) => void;
  onPhotoChange: (url: string) => void;
  onSettingsError: (message: string) => void;
  onTogglePage: (page: AdminPage) => void;
  photoUrl: string;
  savingAppearance: boolean;
  savingMenu: boolean;
  uid: string;
};

export function AppSettingsPage({
  email,
  error,
  fontFamily,
  fontScale,
  hiddenPages,
  menuSections,
  name,
  onAppearanceChange,
  onPhotoChange,
  onSettingsError,
  onTogglePage,
  photoUrl,
  savingAppearance,
  savingMenu,
  uid,
}: Props) {
  const [savingPhoto, setSavingPhoto] = useState(false);
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'AV';
  const avatarRef = ref(storage, `profilePhotos/${uid}/avatar`);

  async function changePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      onSettingsError('Escolha uma imagem JPG, PNG ou WebP de ate 5 MB.');
      return;
    }
    setSavingPhoto(true);
    onSettingsError('');
    try {
      await uploadBytes(avatarRef, file, { contentType: file.type, cacheControl: 'no-cache' });
      const url = new URL(await getDownloadURL(avatarRef));
      url.searchParams.set('v', String(Date.now()));
      await updateDoc(doc(firestore, 'users', uid), { photoUrl: url.toString() });
      onPhotoChange(url.toString());
    } catch {
      onSettingsError('Nao foi possivel salvar a foto de perfil.');
    } finally {
      setSavingPhoto(false);
    }
  }

  async function removePhoto() {
    setSavingPhoto(true);
    onSettingsError('');
    try {
      await updateDoc(doc(firestore, 'users', uid), { photoUrl: '' });
      onPhotoChange('');
      await deleteObject(avatarRef).catch(() => undefined);
    } catch {
      onSettingsError('Nao foi possivel remover a foto de perfil.');
    } finally {
      setSavingPhoto(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Minha conta</p>
        <h2 className="mt-1 text-xl font-semibold text-zinc-950">Configurações do aplicativo</h2>
        <p className="mt-1 text-sm text-zinc-600">Personalize sua experiência no painel administrativo.</p>
      </div>
      {error ? <p className="ui-error" role="alert">{error}</p> : null}

      <section className="ui-card p-5 sm:p-6">
        <div className="flex items-center gap-3"><UserRound size={20} /><h3 className="font-semibold text-zinc-950">Foto de perfil</h3></div>
        <div className="mt-5 flex flex-wrap items-center gap-5">
          <span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-avapex-yellow text-xl font-bold text-avapex-black">
            {photoUrl ? <img alt={`Foto de ${name || 'perfil'}`} className="h-full w-full object-cover" src={photoUrl} /> : initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-zinc-900">{name || 'Administrador'}</p>
            <p className="break-all text-sm text-zinc-500">{email}</p>
            <p className="mt-1 text-xs text-zinc-500">JPG, PNG ou WebP, ate 5 MB.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className={`ui-button h-10 gap-2 bg-zinc-900 px-4 text-sm font-medium text-white ${savingPhoto ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}>
              <Camera size={16} />{savingPhoto ? 'Salvando...' : 'Trocar foto'}
              <input accept="image/jpeg,image/png,image/webp" aria-label="Selecionar foto de perfil" className="sr-only" disabled={savingPhoto} onChange={(event) => void changePhoto(event)} type="file" />
            </label>
            {photoUrl ? <button className="ui-button h-10 border border-zinc-200 bg-white px-4 text-sm text-zinc-700" disabled={savingPhoto} onClick={() => void removePhoto()} type="button">Remover foto</button> : null}
          </div>
        </div>
      </section>

      <section className="ui-card p-5 sm:p-6">
        <div className="flex items-center gap-3"><Type size={20} /><h3 className="font-semibold text-zinc-950">Fonte do aplicativo</h3></div>
        <p className="mt-1 text-sm text-zinc-600">A fonte e o tamanho escolhidos aparecem em todas as telas do painel.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-zinc-700">Tipo de fonte
            <select className="ui-input mt-2 h-11 w-full px-3" disabled={savingAppearance} onChange={(event) => onAppearanceChange(event.target.value as AppFontFamily, fontScale)} value={fontFamily}>
              {fontFamilies.map((font) => <option key={font.value} value={font.value}>{font.label}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium text-zinc-700">Tamanho da fonte
            <select className="ui-input mt-2 h-11 w-full px-3" disabled={savingAppearance} onChange={(event) => onAppearanceChange(fontFamily, Number(event.target.value) as AppFontScale)} value={fontScale}>
              {fontScales.map((scale) => <option key={scale} value={scale}>{scale}%{scale === 100 ? ' (padrao)' : ''}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-5 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
          <p className="font-semibold text-zinc-900">Prévia de leitura</p>
          <p className="mt-1 text-sm text-zinc-600">Confira como os textos e controles do aplicativo ficam para você.</p>
        </div>
        <button className="ui-button mt-4 h-10 gap-2 border border-zinc-200 bg-white px-4 text-sm text-zinc-700" disabled={savingAppearance || (fontFamily === 'inter' && fontScale === 100)} onClick={() => onAppearanceChange('inter', 100)} type="button"><RotateCcw size={15} />Restaurar fonte padrão</button>
      </section>

      <section className="ui-card p-5 sm:p-6">
        <div className="flex items-center gap-3"><Settings2 size={20} /><h3 className="font-semibold text-zinc-950">Personalizar menu</h3></div>
        <p className="mt-1 text-sm text-zinc-600">Escolha quais áreas aparecem no seu menu lateral. Esta aba permanece sempre visível.</p>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          {menuSections.map((section) => <fieldset key={section.label}>
            <legend className="mb-2 text-xs font-semibold uppercase text-zinc-500">{section.label}</legend>
            <div className="space-y-2">
              {section.items.map((item) => <label className="flex min-h-10 items-center gap-3 rounded-lg border border-zinc-200 px-3 text-sm text-zinc-800" key={item.key}>
                <input checked={!hiddenPages.includes(item.key)} disabled={savingMenu} onChange={() => onTogglePage(item.key)} type="checkbox" />
                {item.label}
              </label>)}
            </div>
          </fieldset>)}
        </div>
      </section>
    </div>
  );
}
