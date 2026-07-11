import React, { useState, useEffect } from 'react'
import { BarChart2, Target, TrendingUp, AlertCircle, Info } from 'lucide-react'
import {
  Chart as ChartJS,
  RadialLinearScale,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { PolarArea } from 'react-chartjs-2'
import './Recommendations.css'

ChartJS.register(RadialLinearScale, ArcElement, Tooltip, Legend)

const BACKEND_URL = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' ? '' : 'http://localhost:5005')

export default function Recommendations() {
  const [featureImportance, setFeatureImportance] = useState([])
  const [optimalRanges, setOptimalRanges] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true)
        const [impRes, rangesRes] = await Promise.all([
          fetch(`${BACKEND_URL}/api/feature-importance`),
          fetch(`${BACKEND_URL}/api/optimal-ranges`)
        ])
        
        if (impRes.ok) {
          const impData = await impRes.json()
          setFeatureImportance(impData.features || [])
        }
        
        if (rangesRes.ok) {
          const rangesData = await rangesRes.json()
          setOptimalRanges(rangesData.optimal_ranges || {})
        }
      } catch (err) {
        setError('Failed to load analytics: ' + err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchAnalytics()
  }, [])

  if (loading) {
    return (
      <div className="recommendations" style={{display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh'}}>
        <div className="loading-spinner"></div>
      </div>
    )
  }

  // Prepare Chart.js data
  const chartData = {
    labels: featureImportance.slice(0, 7).map(f => f.feature.replace('_', ' ').toUpperCase()),
    datasets: [
      {
        label: 'Importance Weight',
        data: featureImportance.slice(0, 7).map(f => f.importance * 100),
        backgroundColor: [
          'rgba(236, 72, 153, 0.6)', // Pink
          'rgba(59, 130, 246, 0.6)', // Blue
          'rgba(16, 185, 129, 0.6)', // Green
          'rgba(245, 158, 11, 0.6)', // Yellow
          'rgba(139, 92, 246, 0.6)', // Purple
          'rgba(14, 165, 233, 0.6)', // Sky
          'rgba(244, 63, 94, 0.6)',  // Rose
        ],
        borderColor: [
          'rgba(236, 72, 153, 1)',
          'rgba(59, 130, 246, 1)',
          'rgba(16, 185, 129, 1)',
          'rgba(245, 158, 11, 1)',
          'rgba(139, 92, 246, 1)',
          'rgba(14, 165, 233, 1)',
          'rgba(244, 63, 94, 1)',
        ],
        borderWidth: 1,
      },
    ],
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      r: {
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
        angleLines: {
          color: 'rgba(255, 255, 255, 0.1)'
        },
        pointLabels: {
          color: 'rgba(255, 255, 255, 0.8)',
          font: { size: 12, family: 'Inter' }
        },
        ticks: {
          display: false,
        }
      }
    },
    plugins: {
      legend: {
        position: 'right',
        labels: {
          color: '#fff',
          padding: 20,
          font: { family: 'Inter' }
        }
      }
    }
  }

  return (
    <div className="recommendations fade-up">
      <div className="page-header text-center" style={{marginBottom: '40px'}}>
        <h2>Deep <span className="text-gradient">Insights</span></h2>
        <p className="subtitle-glow">Data-driven analysis of what makes a viral hit</p>
      </div>

      {error && (
        <div className="error-message" style={{marginBottom: '20px'}}>
          <AlertCircle size={18} /> {error}
        </div>
      )}

      <div className="analytics-layout">
        {/* Left Column: Feature Importance Chart */}
        <div className="analytics-left">
          <section className="analytics-card glass-card chart-card">
            <div className="card-header">
              <BarChart2 size={24} color="#EC4899" />
              <h3>Model Weights</h3>
            </div>
            <p className="card-description" style={{marginBottom: '20px'}}>Which musical elements most strongly predict virality across our dataset.</p>
            
            <div className="chart-container" style={{height: '350px', width: '100%'}}>
              {featureImportance.length > 0 ? (
                <PolarArea data={chartData} options={chartOptions} />
              ) : (
                <div style={{color: '#aaa', textAlign: 'center', paddingTop: '50px'}}>No data available</div>
              )}
            </div>
          </section>
        </div>

        {/* Right Column: Optimal Ranges */}
        <div className="analytics-right">
          <section className="analytics-card glass-card ranges-card">
            <div className="card-header">
              <Target size={24} color="#10B981" />
              <h3>The Viral Sweet Spot</h3>
            </div>
            <p className="card-description" style={{marginBottom: '30px'}}>Target ranges based on the highest performing tracks.</p>
            
            <div className="sweet-spot-list">
              {Object.entries(optimalRanges).slice(0, 6).map(([feature, range], idx) => {
                if (range.min === null || range.max === null) return null;
                
                let minStr = range.min.toFixed(2);
                let maxStr = range.max.toFixed(2);
                let globalMin = 0;
                let globalMax = 1;
                
                if (feature === 'tempo') {
                  minStr = range.min.toFixed(0);
                  maxStr = range.max.toFixed(0);
                  globalMin = 60;
                  globalMax = 200;
                } else if (feature === 'loudness') {
                  minStr = range.min.toFixed(1);
                  maxStr = range.max.toFixed(1);
                  globalMin = -20;
                  globalMax = 0;
                } else if (feature === 'key' || feature === 'mode' || feature === 'time_signature' || feature === 'duration_ms') {
                    return null; // Skip non-visualizable ones easily
                }

                // Calculate CSS percentages for the sweet spot gradient
                let leftPercent = Math.max(0, ((range.min - globalMin) / (globalMax - globalMin)) * 100);
                let rightPercent = Math.min(100, ((range.max - globalMin) / (globalMax - globalMin)) * 100);
                let widthPercent = rightPercent - leftPercent;

                return (
                  <div key={idx} className="sweet-spot-item">
                    <div className="sweet-spot-header">
                      <span className="sweet-spot-name">{feature.replace('_', ' ')}</span>
                      <span className="sweet-spot-values">{minStr} - {maxStr} {feature === 'tempo' ? 'BPM' : feature === 'loudness' ? 'dB' : ''}</span>
                    </div>
                    
                    <div className="gauge-track">
                      <div 
                        className="gauge-fill" 
                        style={{
                          left: `${leftPercent}%`, 
                          width: `${widthPercent}%`,
                          background: 'linear-gradient(90deg, #10B981, #34D399)'
                        }}
                      ></div>
                    </div>
                    <div className="gauge-labels">
                      <span>{globalMin}</span>
                      <span>{globalMax}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
