import { useEffect, useState } from "react";
import api, { errorText } from "../lib/api";
import {
  Activity,
  CheckCircle2,
  Gauge,
  Route,
  Waves,
} from "lucide-react";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";

const wasteColors = ["#2F76A8", "#75B9D3", "#39866B"];


function SummaryCard({ icon: Icon, label, value, unit, description }) {
  return (
    <article className="analytics-stat-card">
      <div className="analytics-stat-top">
        <span>{label}</span>
        <div className="analytics-stat-icon">
          <Icon size={19} />
        </div>
      </div>

      <div className="analytics-stat-value">
        {value}
        {unit && <span>{unit}</span>}
      </div>

      <p>{description}</p>
    </article>
  );
}

function EmptyChart({ message }) {
  return (
    <div className="analytics-empty-chart">
      <div className="analytics-empty-icon">
        <Activity size={24} />
      </div>
      <strong>No data available yet</strong>
      <span>{message}</span>
    </div>
  );
}

function ChartPanel({ title, description, children, className = "" }) {
  return (
    <article className={`panel analytics-chart-panel ${className}`}>
      <div className="analytics-chart-heading">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>

      {children}
    </article>
  );
}

export default function Analytics() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .get("/stats")
      .then((res) => setStats(res.data))
      .catch((e) => setError(errorText(e)));
  }, []);

  const wasteData = stats?.waste || [];
  const missionDistanceData = stats?.perMission || [];
  const cleanupTrendData = stats?.perDay || [];
  const hasWasteData = wasteData.length > 0;
  const hasMissionData = missionDistanceData.length > 0;
  const hasTrendData = cleanupTrendData.length > 0;

  return (
    <div className="analytics-page">
      <div className="page-heading">
        <div>
          <h1>Analytics</h1>
          <p>Review cleanup performance and mission statistics.</p>
        </div>
      </div>

      {error && <div className="control-warning">{error}</div>}

      {/* Performance overview */}
      <section className="analytics-overview">
        <SummaryCard
          icon={Waves}
          label="Missions"
          value={stats ? stats.missions : "—"}
          description="All missions in the database"
        />

        <SummaryCard
          icon={CheckCircle2}
          label="Completed missions"
          value={stats ? stats.completed : "—"}
          description="Trips that returned home"
        />

        <SummaryCard
          icon={Route}
          label="Waterway covered"
          value={stats ? stats.totalDistanceKm : "—"}
          unit="km"
          description="Total GPS distance on missions"
        />

        <SummaryCard
          icon={Gauge}
          label="Time on water"
          value={stats ? stats.totalHours : "—"}
          unit="h"
          description={stats ? `${stats.telemetryCount} telemetry points stored` : "Mission hours"}
        />
      </section>

      {/* Waste distribution and mission performance */}
      <section className="analytics-chart-grid">
        <ChartPanel
          title="Waste distribution"
          description="AI detections by category"
          className="analytics-waste-panel"
        >
          {hasWasteData ? (
            <div className="analytics-donut-layout">
              <div className="analytics-donut">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={wasteData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius="62%"
                      outerRadius="88%"
                      paddingAngle={3}
                    >
                      {wasteData.map((entry, index) => (
                        <Cell
                          key={entry.name}
                          fill={wasteColors[index % wasteColors.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="analytics-legend">
                {wasteData.map((item, index) => (
                  <div className="analytics-legend-item" key={item.name}>
                    <span
                      className="analytics-legend-dot"
                      style={{
                        backgroundColor:
                          wasteColors[index % wasteColors.length],
                      }}
                    />
                    <span>{item.name}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyChart message="Waste categories appear when AI detections are uploaded." />
          )}
        </ChartPanel>

        <ChartPanel
          title="Mission performance"
          description="Distance covered per mission"
          className="analytics-distance-panel"
        >
          {hasMissionData ? (
            <div className="analytics-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={missionDistanceData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#E3EDF4"
                  />
                  <XAxis
                    dataKey="mission"
                    tick={{ fill: "#64849B", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#64849B", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    unit=" km"
                  />
                  <Tooltip />
                  <Bar
                    dataKey="distance"
                    name="Distance"
                    fill="#2F76A8"
                    radius={[5, 5, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChart message="Distance statistics will appear after missions have recorded GPS routes." />
          )}
        </ChartPanel>
      </section>

      {/* Cleanup trends */}
      <section className="analytics-trend-section">
        <ChartPanel
          title="Cleanup trends"
          description="Distance covered per day"
          className="analytics-trend-panel"
        >
          {hasTrendData ? (
            <div className="analytics-chart analytics-trend-chart">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={cleanupTrendData}
                  margin={{ top: 10, right: 15, left: 0, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#E3EDF4"
                  />
                  <XAxis
                    dataKey="period"
                    tick={{ fill: "#64849B", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#64849B", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    unit=" km"
                  />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="distance"
                    name="Distance (km)"
                    stroke="#2F76A8"
                    strokeWidth={3}
                    dot={{ r: 4, fill: "#2F76A8" }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChart message="Trends appear once missions have recorded GPS tracks." />
          )}
        </ChartPanel>
      </section>
    </div>
  );
}