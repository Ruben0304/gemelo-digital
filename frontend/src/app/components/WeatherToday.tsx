import { WeatherData } from '@/types';
import { Cloud, Droplets, Wind, Gauge, Info, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

// Tipos de animaciones disponibles
export type LottieAnimationType = 'sunny' | 'partly-cloudy' | 'cloudy' | 'rainy' | 'night';

interface WeatherTodayProps {
  weather: WeatherData;
  onWeatherOverride?: (type: LottieAnimationType | null) => void;
}

export default function WeatherToday({ weather, onWeatherOverride }: WeatherTodayProps) {
  const [showModal, setShowModal] = useState(false);
  const { temperature, solarRadiation, cloudCover, humidity, windSpeed } = weather;
  const locationLabel = weather.locationName ?? 'Ubicación';

  // Mapeo de animaciones Lottie
  const lottieFiles = {
    sunny: '/lottie/Weather-sunny.lottie',
    'partly-cloudy': '/lottie/Weather-partly shower.lottie',
    cloudy: '/lottie/Cloud Lottie Animation.lottie',
    rainy: '/lottie/rainy icon.lottie',
    night: '/lottie/Weather Night - Clear sky.lottie',
  };

  // Determinar qué animación usar según el clima actual
  const getLottieAnimation = (): LottieAnimationType => {
    // Basado en la nubosidad reportada por la fuente meteorológica
    if (cloudCover < 20) return 'sunny';
    if (cloudCover < 50) return 'partly-cloudy';
    if (cloudCover < 80) return 'cloudy';
    return 'rainy';
  };

  const currentAnimation = getLottieAnimation();

  // El fondo del panel principal sigue siempre la condición detectada automáticamente
  useEffect(() => {
    onWeatherOverride?.(null);
  }, []); // Solo se ejecuta al montar

  // Componente de animación Lottie
  const WeatherAnimation = ({ type, size = 'w-24 h-24' }: { type: LottieAnimationType; size?: string }) => (
    <div className={size}>
      <DotLottieReact
        src={lottieFiles[type]}
        loop
        autoplay
      />
    </div>
  );

  const getWeatherConditionText = () => {
    if (weather.description) return weather.description;
    if (cloudCover < 20) return 'Soleado';
    if (cloudCover < 50) return 'Parcialmente nublado';
    if (cloudCover < 80) return 'Nublado';
    return 'Lluvioso';
  };

  // Determinar calidad para generación fotovoltaica
  const getSolarQuality = () => {
    // Basado en radiación solar y nubosidad
    // Radiación óptima: >600 W/m², Nubosidad baja: <30%
    const radiationScore = solarRadiation / 800; // Normalizado (800 W/m² = excelente)
    const cloudScore = (100 - cloudCover) / 100; // Invertido (menos nubes = mejor)
    const totalScore = (radiationScore * 0.7 + cloudScore * 0.3); // Radiación pesa más

    if (totalScore >= 0.7) {
      return {
        color: 'bg-green-500',
        text: 'Excelente',
        textColor: 'text-green-600',
        bgLight: 'bg-green-100/50'
      };
    } else if (totalScore >= 0.4) {
      return {
        color: 'bg-yellow-500',
        text: 'Moderado',
        textColor: 'text-yellow-600',
        bgLight: 'bg-yellow-100/50'
      };
    } else {
      return {
        color: 'bg-red-500',
        text: 'Bajo',
        textColor: 'text-red-600',
        bgLight: 'bg-red-100/50'
      };
    }
  };

  const solarQuality = getSolarQuality();

  return (
    <>
      <div className="h-full flex flex-col bg-white/30 backdrop-blur-md rounded-3xl p-5">
        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-gray-900">Clima actual</h3>
            <span className="text-[10px] text-sky-600 font-medium bg-sky-100/50 px-2 py-0.5 rounded-full">
              {locationLabel}
            </span>
          </div>
        </div>

        {/* Main Weather Display */}
        <div className="flex items-center gap-6 mb-4 p-4 bg-white/30 backdrop-blur-sm rounded-2xl">
          <div className="flex-shrink-0">
            <WeatherAnimation type={currentAnimation} size="w-32 h-32" />
          </div>
          <div className="flex-1">
            <div className="text-5xl font-extrabold text-gray-900 leading-none mb-1">
              {temperature.toFixed(1)}°
            </div>
            <div className="text-sm font-medium text-gray-600">
              {getWeatherConditionText()}
            </div>
          </div>
        </div>

        {/* Indicador de calidad solar */}
        <div className={`p-4 ${solarQuality.bgLight} backdrop-blur-sm rounded-2xl mb-4`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-4 h-4 rounded-full ${solarQuality.color} animate-pulse`}></div>
              <div>
                <div className="text-[10px] text-gray-600">Condiciones para generación FV</div>
                <div className={`text-lg font-bold ${solarQuality.textColor}`}>
                  {solarQuality.text}
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="p-2 bg-white/40 hover:bg-white/60 rounded-full transition-all duration-200"
              title="Ver detalles"
            >
              <Info className="w-5 h-5 text-gray-700" />
            </button>
          </div>
        </div>

        {/* Resumen rápido */}
        {weather.forecast && weather.forecast.length > 0 && (
          <div className="flex items-center justify-around text-center">
            <div>
              <div className="text-[10px] text-gray-600 mb-0.5">Máx/Mín</div>
              <div className="text-sm font-bold text-gray-900">
                {weather.forecast[0].maxTemp.toFixed(0)}° / {weather.forecast[0].minTemp.toFixed(0)}°
              </div>
            </div>
            <div>
              <div className="text-[10px] text-gray-600 mb-0.5">Producción est.</div>
              <div className="text-sm font-bold text-green-500">
                {weather.forecast[0].predictedProduction.toFixed(0)} kWh
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal con detalles */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-6 max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {/* Header del modal */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">Detalles del clima</h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-all duration-200"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {/* Temperatura principal */}
            <div className="flex items-center justify-center gap-4 mb-6 p-4 bg-gradient-to-br from-blue-50 to-sky-50 rounded-2xl">
              <div className="flex-shrink-0">
                <WeatherAnimation type={currentAnimation} size="w-32 h-32" />
              </div>
              <div>
                <div className="text-5xl font-extrabold text-gray-900">
                  {temperature.toFixed(1)}°
                </div>
                <div className="text-sm font-medium text-gray-600 mt-1">
                  {getWeatherConditionText()}
                </div>
              </div>
            </div>

            {/* Indicador solar */}
            <div className={`p-4 ${solarQuality.bgLight} rounded-2xl mb-6`}>
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full ${solarQuality.color}`}></div>
                <div className="flex-1">
                  <div className="text-xs text-gray-600">Calidad para generación fotovoltaica</div>
                  <div className={`text-2xl font-bold ${solarQuality.textColor}`}>
                    {solarQuality.text}
                  </div>
                </div>
              </div>
            </div>

            {/* Métricas detalladas */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="p-4 bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl">
                <div className="flex items-center gap-2 mb-2">
                  <Gauge className="w-5 h-5 text-orange-500" />
                  <span className="text-xs text-gray-600">Radiación solar</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">{solarRadiation}</div>
                <div className="text-xs text-gray-500">W/m²</div>
              </div>

              <div className="p-4 bg-gradient-to-br from-gray-50 to-slate-50 rounded-2xl">
                <div className="flex items-center gap-2 mb-2">
                  <Cloud className="w-5 h-5 text-gray-500" />
                  <span className="text-xs text-gray-600">Nubosidad</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">{cloudCover}</div>
                <div className="text-xs text-gray-500">%</div>
              </div>

              <div className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl">
                <div className="flex items-center gap-2 mb-2">
                  <Droplets className="w-5 h-5 text-blue-500" />
                  <span className="text-xs text-gray-600">Humedad</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">{humidity}</div>
                <div className="text-xs text-gray-500">%</div>
              </div>

              <div className="p-4 bg-gradient-to-br from-cyan-50 to-teal-50 rounded-2xl">
                <div className="flex items-center gap-2 mb-2">
                  <Wind className="w-5 h-5 text-cyan-500" />
                  <span className="text-xs text-gray-600">Viento</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">{windSpeed.toFixed(1)}</div>
                <div className="text-xs text-gray-500">km/h</div>
              </div>
            </div>

            {/* Pronóstico de hoy */}
            {weather.forecast && weather.forecast.length > 0 && (
              <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl">
                <div className="text-xs font-semibold text-gray-700 mb-3">Pronóstico de hoy</div>
                <div className="flex items-center justify-around">
                  <div className="text-center">
                    <div className="text-xs text-gray-600 mb-1">Máxima</div>
                    <div className="text-2xl font-bold text-red-500">
                      {weather.forecast[0].maxTemp.toFixed(0)}°
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-600 mb-1">Mínima</div>
                    <div className="text-2xl font-bold text-blue-500">
                      {weather.forecast[0].minTemp.toFixed(0)}°
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-600 mb-1">Producción</div>
                    <div className="text-2xl font-bold text-green-600">
                      {weather.forecast[0].predictedProduction.toFixed(0)}
                    </div>
                    <div className="text-xs text-gray-500">kWh</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
