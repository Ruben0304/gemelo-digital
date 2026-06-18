import { WeatherData, WeatherCondition } from '@/types';
import { Cloud, CloudRain, Sun, CloudSun, Droplets, Wind, Gauge } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface WeatherWidgetProps {
  weather: WeatherData;
}

export default function WeatherWidget({ weather }: WeatherWidgetProps) {
  const { temperature, solarRadiation, cloudCover, humidity, windSpeed, forecast } = weather;
  const providerLabel = weather.provider ?? 'Fuente meteorológica';
  const locationLabel = weather.locationName ?? 'Ubicación sin definir';
  const lastUpdated = weather.lastUpdated ? new Date(weather.lastUpdated) : null;
  const lastUpdatedLabel = lastUpdated
    ? lastUpdated.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    : null;

  // Get weather icon based on condition.
  // El tamaño se pasa como clase Tailwind completa para que el compilador la detecte
  // (las clases construidas dinámicamente como `w-${n}` no se generan en el build).
  const getWeatherIcon = (condition: WeatherCondition, className: string = 'w-6 h-6') => {
    switch (condition) {
      case 'sunny':
        return <Sun className={className + ' text-yellow-400'} />;
      case 'partly-cloudy':
        return <CloudSun className={className + ' text-yellow-300'} />;
      case 'cloudy':
        return <Cloud className={className + ' text-gray-400'} />;
      case 'rainy':
        return <CloudRain className={className + ' text-blue-400'} />;
      default:
        return <Sun className={className + ' text-yellow-400'} />;
    }
  };

  const getCurrentCondition = (): WeatherCondition => {
    if (cloudCover < 20) return 'sunny';
    if (cloudCover < 50) return 'partly-cloudy';
    if (cloudCover < 80) return 'cloudy';
    return 'rainy';
  };

  const currentCondition = getCurrentCondition();

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs uppercase tracking-wide text-sky-600">
            {providerLabel}
          </span>
          {lastUpdatedLabel && (
            <span className="text-[11px] text-gray-500">
              Actualizado {lastUpdatedLabel}
            </span>
          )}
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-1">
          Clima en {locationLabel}
        </h2>
        <p className="text-sm text-gray-600">
          Condiciones actuales y pronóstico extendido
        </p>
      </div>

      {/* Current weather */}
      <div className="flex items-center justify-between mb-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
        <div className="flex items-center gap-4">
          {getWeatherIcon(currentCondition, 'w-16 h-16')}
          <div>
            <div className="text-5xl font-extrabold text-gray-900">
              {temperature.toFixed(1)}°
            </div>
            <div className="text-sm text-gray-600 mt-1">
              {weather.description
                ? weather.description.charAt(0).toUpperCase() + weather.description.slice(1)
                : currentCondition === 'sunny'
                ? 'Soleado'
                : currentCondition === 'partly-cloudy'
                ? 'Parcialmente nublado'
                : currentCondition === 'cloudy'
                ? 'Nublado'
                : 'Lluvioso'}
            </div>
          </div>
        </div>
      </div>

      {/* Weather metrics */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2 mb-1">
            <Gauge className="w-4 h-4 text-orange-400" />
            <span className="text-xs text-gray-600">Radiación solar</span>
          </div>
          <div className="text-lg font-bold text-gray-900">
            {solarRadiation} W/m²
          </div>
        </div>

        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2 mb-1">
            <Cloud className="w-4 h-4 text-gray-400" />
            <span className="text-xs text-gray-600">Nubosidad</span>
          </div>
          <div className="text-lg font-bold text-gray-900">
            {cloudCover}%
          </div>
        </div>

        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2 mb-1">
            <Droplets className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-gray-600">Humedad</span>
          </div>
          <div className="text-lg font-bold text-gray-900">
            {humidity}%
          </div>
        </div>

        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2 mb-1">
            <Wind className="w-4 h-4 text-cyan-400" />
            <span className="text-xs text-gray-600">Viento</span>
          </div>
          <div className="text-lg font-bold text-gray-900">
            {windSpeed} km/h
          </div>
        </div>
      </div>

      {/* 5-day forecast */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Pronóstico a 5 días
        </h3>
        <div className="space-y-2">
          {forecast.slice(0, 5).map((day, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-3 flex-1">
                {getWeatherIcon(day.condition, 'w-6 h-6')}
                <span className="text-sm font-medium text-gray-700 w-24">
                  {index === 0
                    ? 'Hoy'
                    : format(new Date(day.date), 'EEE', { locale: es })}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-xs text-gray-600">Temp</div>
                  <div className="text-sm font-semibold text-gray-900">
                    {day.maxTemp.toFixed(0)}° / {day.minTemp.toFixed(0)}°
                  </div>
                </div>
                <div className="text-right w-20">
                  <div className="text-xs text-gray-600">Prod.</div>
                  <div className="text-sm font-semibold text-green-500">
                    {day.predictedProduction.toFixed(0)} kWh
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-5 text-xs text-gray-600">
        Estos datos de {providerLabel} alimentan todas las proyecciones energéticas. No se dispone de mediciones directas de generación o estado de carga.
      </p>
    </div>
  );
}
