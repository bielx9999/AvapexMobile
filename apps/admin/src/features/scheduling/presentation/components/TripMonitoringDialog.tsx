import { useEffect, useState } from 'react';
import { ExternalLink, MapPin, Send, X } from 'lucide-react';
import type { Trip } from '../../../shared/domain/models';
import { sendAdminTripMessage, watchTripGpsPoints, watchTripMessages, type TripGpsPoint, type TripMessage } from '../../data/tripMonitoringRepository';
import { findDailyStatusOption } from '../programacaoConfig';

type Props = { trip: Trip; onClose: () => void };

export function TripMonitoringDialog({ trip, onClose }: Props) {
  const [messages, setMessages] = useState<TripMessage[]>([]);
  const [points, setPoints] = useState<TripGpsPoint[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const onError = (cause: Error) => setError(cause.message);
    const stopMessages = watchTripMessages(trip.id, setMessages, onError);
    const stopPoints = watchTripGpsPoints(trip.id, setPoints, onError);
    return () => { stopMessages(); stopPoints(); };
  }, [trip.id]);

  async function sendMessage() {
    if (!draft.trim() || sending) return;
    setSending(true);
    setError('');
    try {
      await sendAdminTripMessage(trip.id, draft);
      setDraft('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nao foi possivel enviar a mensagem.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-3 py-4">
      <section aria-labelledby="trip-monitoring-title" aria-modal="true" className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl" role="dialog">
        <header className="flex items-start justify-between gap-3 border-b border-zinc-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-950" id="trip-monitoring-title">Acompanhamento da viagem</h2>
            <p className="mt-1 text-sm text-zinc-600">{trip.customerRequestNumber || trip.routeName || `${trip.origin} → ${trip.destination}`} · {findDailyStatusOption(trip).label}</p>
          </div>
          <button aria-label="Fechar acompanhamento" className="ui-icon-button h-9 w-9" onClick={onClose} type="button"><X size={18} /></button>
        </header>
        <div className="grid min-h-0 flex-1 gap-0 overflow-y-auto lg:grid-cols-2">
          <section className="border-b border-zinc-200 p-5 lg:border-b-0 lg:border-r">
            <h3 className="font-semibold text-zinc-900">Pontos GPS da viagem</h3>
            <p className="mt-1 text-xs text-zinc-500">Ultimos 100 pontos registrados automaticamente pelo aplicativo.</p>
            <div className="mt-4 max-h-[45vh] space-y-2 overflow-y-auto">
              {points.length ? points.map((point) => (
                <div className="flex items-start gap-3 rounded-lg border border-zinc-200 p-3" key={point.id}>
                  <MapPin className="mt-0.5 shrink-0 text-zinc-600" size={16} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-zinc-900">{point.recordedAt?.toLocaleString('pt-BR') ?? 'Sincronizando...'}</p>
                    <p className="text-xs text-zinc-500">{point.latitude.toFixed(6)}, {point.longitude.toFixed(6)} · precisao {Math.round(point.accuracy)} m</p>
                  </div>
                  <a aria-label="Abrir ponto no mapa" className="text-zinc-600 hover:text-zinc-950" href={`https://www.google.com/maps/search/?api=1&query=${point.latitude},${point.longitude}`} rel="noreferrer" target="_blank"><ExternalLink size={16} /></a>
                </div>
              )) : <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-sm text-zinc-500">Nenhum ponto GPS registrado nesta viagem.</p>}
            </div>
          </section>
          <section className="flex min-h-[360px] flex-col p-5">
            <h3 className="font-semibold text-zinc-900">Mensagens com o motorista</h3>
            <p className="mt-1 text-xs text-zinc-500">As mensagens ficam no historico desta viagem.</p>
            <div aria-live="polite" className="mt-4 max-h-[45vh] min-h-32 flex-1 space-y-2 overflow-y-auto">
              {messages.length ? messages.map((message) => (
                <div className={`rounded-lg p-3 text-sm ${message.senderRole === 'admin' ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-900'}`} key={message.id}>
                  <div className="mb-1 flex justify-between gap-3 text-xs opacity-70"><span>{message.senderRole === 'admin' ? 'Logistica' : 'Motorista'}</span><span>{message.createdAt?.toLocaleString('pt-BR') ?? 'Enviando...'}</span></div>
                  <p className="whitespace-pre-wrap break-words">{message.text}</p>
                </div>
              )) : <p className="text-sm text-zinc-500">Nenhuma mensagem enviada.</p>}
            </div>
            <label className="mt-4 block text-sm font-medium text-zinc-700" htmlFor="admin-trip-message">Nova mensagem</label>
            <textarea className="ui-input mt-2 min-h-20 w-full resize-y px-3 py-2 text-sm" id="admin-trip-message" maxLength={1000} onChange={(event) => setDraft(event.target.value)} placeholder="Escreva uma orientacao ou pergunte ao motorista" value={draft} />
            <button className="ui-button mt-2 h-10 self-end gap-2 bg-zinc-900 px-4 text-sm font-semibold text-white disabled:opacity-50" disabled={!draft.trim() || sending || !trip.driverId} onClick={() => void sendMessage()} type="button"><Send size={15} />Enviar</button>
            {!trip.driverId ? <p className="mt-2 text-xs text-amber-700">Vincule um motorista para iniciar a conversa.</p> : null}
            {error ? <p className="mt-2 text-sm text-red-700" role="alert">{error}</p> : null}
          </section>
        </div>
      </section>
    </div>
  );
}
