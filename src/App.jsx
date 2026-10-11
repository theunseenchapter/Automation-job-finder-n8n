import React, { useMemo, useRef, useState } from 'react';

const API_PATH = '/n8n-api/webhook/ai-job-agent-search';
const UPLOAD_PATH = '/n8n-api/webhook/ai-job-agent-upload-resume';
const DEFAULT_FILTERS = { locations: '', workMode: 'any', experienceMaxYears: 1, postedWithinDays: 30, maxJobsToClassify: 80, minSalary: '', roleCategories: ['software','backend','ai_ml','data'], employmentTypes: ['full-time','internship','contract','part-time'], sources: ['himalayas','arbeitnow','remoteok','remotive','greenhouse','lever','ashby'], includeKeywords: '', excludeKeywords: '', salaryOnly: false, includeRemoteWithUnknownLocation: true };
const ROLE_OPTIONS = [{id:'software',label:'Software engineering'},{id:'backend',label:'Backend / APIs'},{id:'frontend',label:'Frontend / React'},{id:'ai_ml',label:'AI / ML / LLM'},{id:'data',label:'Data engineering / ETL'},{id:'database',label:'Databases / SQL'},{id:'qa',label:'QA / test automation'},{id:'devops',label:'DevOps / cloud / platform'},{id:'mobile',label:'Mobile development'},{id:'security',label:'Security engineering'},{id:'internship',label:'Internship / graduate programmes'}];
const SOURCE_OPTIONS = [{id:'himalayas',label:'Himalayas'},{id:'arbeitnow',label:'Arbeitnow'},{id:'remoteok',label:'Remote OK'},{id:'remotive',label:'Remotive'},{id:'greenhouse',label:'Greenhouse career pages'},{id:'lever',label:'Lever career pages'},{id:'ashby',label:'Ashby career pages'}];
const TYPE_OPTIONS = [{id:'full-time',label:'Full-time'},{id:'internship',label:'Internship'},{id:'contract',label:'Contract / freelance'},{id:'part-time',label:'Part-time'}];

const initialSources = [
  { name: 'Himalayas', kind: 'Remote / entry-level feed' },
  { name: 'Arbeitnow', kind: 'Public job board' },
  { name: 'Remotive', kind: 'Remote software jobs' },
  { name: 'Greenhouse', kind: 'Company career boards' },
  { name: 'Lever', kind: 'Company career boards' },
  { name: 'Ashby', kind: 'Company career boards' }
];

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function getReportBuckets(report) {
  const confirmed = safeArray(
    report?.confirmed_jobs || report?.confirmed_0_to_1_years_jobs ||
    (report?.eligible_jobs ? report.eligible_jobs.filter(j => j.qualifies_for_0_to_1_year_filter || j.experience_tier === 'CONFIRMED_0_TO_1_YEARS') : [])
  );
  const likely = safeArray(
    report?.likely_entry_level_jobs_for_manual_verification ||
    report?.likely_entry_level_jobs
  );
  const manual = safeArray(
    report?.other_jobs_requiring_experience_review ||
    report?.manual_review_jobs
  );
  const excluded = safeArray(
    report?.excluded_over_one_year_or_senior_jobs ||
    report?.excluded_jobs
  );
  const careerPages = safeArray(report?.company_career_pages);
  const feedCompanies = safeArray(report?.companies_seen_in_public_job_feeds);
  const selectedCompanies = safeArray(report?.companies_with_shortlisted_jobs);
  const allJobs = [...confirmed, ...likely, ...manual];
  return { confirmed, likely, manual, excluded, careerPages, feedCompanies, selectedCompanies, allJobs };
}

function fmtDate(value) {
  if (!value) return 'Date not supplied';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function safeHost(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

function ScorePill({ score }) {
  if (score === null || score === undefined || score === '') return <span className="score-pill muted">Not scored</span>;
  const n = Math.max(0, Math.min(100, Number(score) || 0));
  return <span className={`score-pill ${n >= 70 ? 'high' : n >= 45 ? 'mid' : 'low'}`}>{n}<small>/100 relevance</small></span>;
}

function StatusPill({ tier, fallback }) {
  const val = String(tier || fallback || 'REVIEW').toUpperCase();
  if (val.includes('CONFIRMED') || val.includes('ELIGIBLE_0')) return <span className="tag tag-green"><i />Within target experience</span>;
  if (val.includes('LIKELY') || val.includes('ENTRY_LEVEL')) return <span className="tag tag-amber"><i />Entry-level · verify</span>;
  if (val.includes('EXCLUDED') || val.includes('OVER_ONE')) return <span className="tag tag-red"><i />Over target</span>;
  return <span className="tag tag-slate"><i />Needs review</span>;
}

function Icon({ name, size = 18 }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
  const paths = {
    spark: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="m19 16 .9 2.1L22 19l-2.1.9L19 22l-.9-2.1L16 19l2.1-.9L19 16Z"/></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></>,
    building: <><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 7h2M9 11h2M9 15h2M14 7h2M14 11h2M14 15h2M10 21v-3h4v3"/></>,
    arrow: <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
    file: <><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/><path d="M13 2v7h7M8 13h8M8 17h8"/></>,
    external: <><path d="M14 3h7v7"/><path d="M10 14 21 3"/><path d="M19 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6"/></>,
    refresh: <><path d="M20 7v5h-5"/><path d="M4 17v-5h5"/><path d="M5.6 9a7 7 0 0 1 11.6-2L20 12M4 12l2.8 5a7 7 0 0 0 11.6-2"/></>,
    upload: <><path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 20h16"/></>,
    chevron: <path d="m6 9 6 6 6-6"/>,
    filter: <><path d="M4 5h16M7 12h10M10 19h4"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    warning: <><path d="M12 3 22 20H2L12 3Z"/><path d="M12 9v4M12 17h.01"/></>,
    globe: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></>,
    sliders: <><path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/></>
  };
  return <svg {...common}>{paths[name] || paths.spark}</svg>;
}

function JobCard({ job, onSelect }) {
  const [expanded, setExpanded] = useState(false);
  const title = job.title || 'Untitled role';
  const company = job.company || 'Company not listed';
  const location = job.location || 'Location not specified';
  const applicationUrl = job.application_link || job.application_url || job.listing_url || job.source_link || '';
  const careerUrl = job.company_career_page || '';
  const skills = safeArray(job.matching_skills);
  const missing = safeArray(job.missing_skills);

  return (
    <article className="job-card">
      <div className="job-topline">
        <div className="company-mark">{company.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || 'CO'}</div>
        <div className="job-heading">
          <div className="job-title-row">
            <button className="job-title-button" onClick={() => setExpanded(v => !v)}>{title}</button>
            <ScorePill score={job.role_relevance_score ?? job.match_score} />
          </div>
          <div className="job-company">{company}<span className="dot-sep">·</span>{location}</div>
        </div>
        <button className="icon-button expand-button" aria-label="Show job details" onClick={() => setExpanded(v => !v)}><Icon name="chevron" /></button>
      </div>

      <div className="job-tags">
        <StatusPill tier={job.experience_tier || job.experience_requirement_status} fallback={job.recommendation} />
        {job.source_name && <span className="tag tag-slate">{job.source_name}</span>}
        {job.employment_type && <span className="tag tag-slate">{job.employment_type}</span>}
        {job.published_date && <span className="date-label"><Icon name="clock" size={13} />{fmtDate(job.published_date)}</span>}
      </div>

      <p className="job-reason">{job.eligibility_reason || job.reason || job.experience_evidence || 'Open the original listing to verify experience requirements and location eligibility.'}</p>

      {skills.length > 0 && <div className="skill-row">{skills.slice(0, 5).map((s, i) => <span className="skill-chip" key={`${s}-${i}`}>{s}</span>)}</div>}

      {expanded && (
        <div className="job-detail">
          {job.experience_evidence && <div className="detail-block"><span className="detail-label">Experience evidence</span><p>{job.experience_evidence}</p></div>}
          {job.description && <div className="detail-block"><span className="detail-label">Role overview</span><p>{job.description}</p></div>}
          {skills.length > 0 && <div className="detail-block"><span className="detail-label">Matched skills</span><div className="skill-row">{skills.map((s, i) => <span className="skill-chip" key={`${s}-${i}`}>{s}</span>)}</div></div>}
          {missing.length > 0 && <div className="detail-block"><span className="detail-label">Potential gaps</span><div className="skill-row">{missing.map((s, i) => <span className="skill-chip gap" key={`${s}-${i}`}>{s}</span>)}</div></div>}
          {job.salary && <div className="detail-block"><span className="detail-label">Salary</span><p>{job.salary}</p></div>}
          {job.eligibility_reason && <div className="detail-block"><span className="detail-label">Fit notes</span><p>{job.eligibility_reason}</p></div>}
          {job.application_draft && (
            <div className="draft-panel">
              <div className="detail-label">AI application draft</div>
              {job.application_draft.tailored_resume_headline && <h4>{job.application_draft.tailored_resume_headline}</h4>}
              {job.application_draft.tailored_resume_summary && <p>{job.application_draft.tailored_resume_summary}</p>}
              {job.application_draft.cover_letter && <><span className="detail-label">Cover letter</span><p className="cover-letter">{job.application_draft.cover_letter}</p><button className="text-button" onClick={() => navigator.clipboard?.writeText(job.application_draft.cover_letter)}>Copy cover letter</button></>}
              {safeArray(job.application_draft.resume_bullet_edits).length > 0 && <>
                <span className="detail-label">Suggested resume edits</span>
                {job.application_draft.resume_bullet_edits.map((b, i) => <p key={i}><strong>{b.section_or_project || 'Resume'}:</strong> {b.suggested_bullet}</p>)}
              </>}
              {safeArray(job.application_draft.candidate_confirmations_required).length > 0 && <p className="warning-copy">Confirm before applying: {job.application_draft.candidate_confirmations_required.join(', ')}</p>}
            </div>
          )}
        </div>
      )}

      <div className="job-actions">
        <button className="button button-quiet" onClick={() => setExpanded(v => !v)}>{expanded ? 'Hide details' : 'View details'}</button>
        <div className="action-spacer" />
        {careerUrl && <a className="button button-quiet" href={careerUrl} target="_blank" rel="noreferrer">Career page <Icon name="external" size={14} /></a>}
        {applicationUrl && <a className="button button-primary" href={applicationUrl} target="_blank" rel="noreferrer">Open role <Icon name="arrow" size={15} /></a>}
      </div>
    </article>
  );
}

function CareerPageCard({ board }) {
  const working = board.api_status === 'API_RESPONDED';
  return (
    <div className="career-row">
      <div className="career-icon"><Icon name="building" size={18} /></div>
      <div className="career-info">
        <div className="career-name">{board.company}</div>
        <div className="career-meta">{board.ats} <span className="dot-sep">·</span> {board.jobs_returned ?? 0} listings returned by API</div>
        <div className="career-note">{board.note}</div>
      </div>
      <span className={`mini-status ${working ? 'status-ok' : 'status-manual'}`}>{working ? 'API connected' : 'Open manually'}</span>
      <a href={board.career_page_url} target="_blank" rel="noreferrer" className="icon-button" title="Open career page"><Icon name="external" /></a>
    </div>
  );
}

function CompanyRow({ item }) {
  const url = item.career_page_url || item.company_career_page || (item.job_links || [])[0] || '';
  return (
    <div className="career-row">
      <div className="company-mark small">{(item.company || 'CO').replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase()}</div>
      <div className="career-info">
        <div className="career-name">{item.company}</div>
        <div className="career-meta">{item.source || `${item.jobs_found || 0} jobs found in feeds`}</div>
      </div>
      {url ? <a href={url} target="_blank" rel="noreferrer" className="button button-quiet">Open <Icon name="external" size={14} /></a> : <span className="tag tag-slate">No career URL from feed</span>}
    </div>
  );
}

export default function App() {
  const [report, setReport] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('matches');
  const [query, setQuery] = useState('');
  const [onlyRemote, setOnlyRemote] = useState(false);
  const [sourceFilter, setSourceFilter] = useState('all');
  const [showSettings, setShowSettings] = useState(false);
  const [webhookPath, setWebhookPath] = useState(API_PATH);
  const [lastUpdated, setLastUpdated] = useState('');
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(true);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [resumeFile, setResumeFile] = useState(null);
  const [resumeUploadStatus, setResumeUploadStatus] = useState('idle');
  const [resumeUploadMessage, setResumeUploadMessage] = useState('Upload a PDF resume to refresh the local candidate profile.');
  const reportUpload = useRef(null);
  const resumeInput = useRef(null);

  const setFilter = (key, value) => setFilters(prev => ({ ...prev, [key]: value }));
  const toggleFilterItem = (key, item) => setFilters(prev => {
    const current = safeArray(prev[key]);
    return { ...prev, [key]: current.includes(item) ? current.filter(v => v !== item) : [...current, item] };
  });

  const buckets = useMemo(() => getReportBuckets(report), [report]);
  const filterJobs = (jobs) => safeArray(jobs).filter(j => {
    const q = query.trim().toLowerCase();
    const blob = `${j.title || ''} ${j.company || ''} ${j.location || ''} ${j.description || ''} ${j.experience_evidence || ''} ${j.source_name || ''}`.toLowerCase();
    const matchesQuery = !q || blob.includes(q);
    const matchesRemote = !onlyRemote || /remote|worldwide|anywhere|distributed/i.test(`${j.location || ''} ${j.description || ''}`);
    const matchesSource = sourceFilter === 'all' || (j.source_name || j.source || '').toLowerCase().includes(sourceFilter.toLowerCase());
    return matchesQuery && matchesRemote && matchesSource;
  });

  const filteredConfirmed = filterJobs(buckets.confirmed);
  const filteredLikely = filterJobs(buckets.likely);
  const filteredManual = filterJobs(buckets.manual);
  const filteredCombined = filterJobs(buckets.allJobs);

  const allCareerBoards = useMemo(() => buckets.careerPages.filter(board => {
    const q = query.trim().toLowerCase();
    return !q || `${board.company} ${board.ats} ${board.note}`.toLowerCase().includes(q);
  }), [buckets.careerPages, query]);
  const allFeedCompanies = useMemo(() => {
    const merge = new Map();
    [...buckets.feedCompanies, ...buckets.selectedCompanies].forEach(c => {
      const key = String(c.company || '').toLowerCase();
      if (!key) return;
      const prev = merge.get(key);
      merge.set(key, prev ? { ...prev, ...c, jobs_found: Math.max(prev.jobs_found || 0, c.jobs_found || 0) } : c);
    });
    return [...merge.values()].filter(c => !query.trim() || `${c.company} ${c.source || ''}`.toLowerCase().includes(query.trim().toLowerCase())).sort((a,b) => String(a.company).localeCompare(String(b.company)));
  }, [buckets.feedCompanies, buckets.selectedCompanies, query]);

  const stats = report?.results_summary || {};
  const searchScope = report?.search_scope || {};
  const sources = searchScope.source_stats || {};
  const sourceOptions = Object.keys(sources);

  async function uploadResume() {
    if (!resumeFile) {
      setError('Choose a PDF resume first.');
      return;
    }
    if (!resumeFile.name.toLowerCase().endsWith('.pdf') && resumeFile.type !== 'application/pdf') {
      setError('Please upload a PDF file.');
      return;
    }
    if (resumeFile.size > 12 * 1024 * 1024) {
      setError('Please keep the resume PDF under 12 MB.');
      return;
    }
    setResumeUploadStatus('uploading');
    setResumeUploadMessage('Uploading PDF and asking local Qwen to rebuild your candidate profile…');
    setError('');
    try {
      const form = new FormData();
      form.append('resume', resumeFile, resumeFile.name);
      const response = await fetch(UPLOAD_PATH, { method: 'POST', body: form });
      const text = await response.text();
      let data;
      try { data = text ? JSON.parse(text) : {}; } catch { data = { raw_response: text }; }
      if (!response.ok || data.upload_success === false || data.error) {
        const serverDetails = data.message || data.error || (data.raw_response ? String(data.raw_response).slice(0, 1400) : '');
        throw new Error(serverDetails || `Resume upload failed (HTTP ${response.status}).`);
      }
      setResumeUploadStatus('success');
      setResumeUploadMessage(`Profile updated for ${data.candidate?.name || resumeFile.name}. Saved to D:\\job-agent\\candidate-profile.json.`);
    } catch (err) {
      setResumeUploadStatus('error');
      setResumeUploadMessage('Resume upload failed.');
      setError(`${err.message || err}\n\nOpen n8n → Executions and inspect the latest “CareerPilot - Upload Resume and Build Candidate Profile” run. The failed node will show whether this is upload parsing, Ollama, or file writing.`);
    }
  }

  async function runSearch() {
    setStatus('running');
    setError('');
    setReport(null);
    try {
      const activeFilters = {
        ...filters,
        experienceMaxYears: Number(filters.experienceMaxYears),
        postedWithinDays: Number(filters.postedWithinDays),
        maxJobsToClassify: Number(filters.maxJobsToClassify),
        locations: String(filters.locations || '').split(',').map(x => x.trim()).filter(Boolean),
        includeKeywords: String(filters.includeKeywords || '').split(',').map(x => x.trim()).filter(Boolean),
        excludeKeywords: String(filters.excludeKeywords || '').split(',').map(x => x.trim()).filter(Boolean)
      };
      const response = await fetch(webhookPath || API_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ source: 'careerpilot-frontend', requested_at: new Date().toISOString(), filters: activeFilters })
      });
      const text = await response.text();
      let data;
      try { data = text ? JSON.parse(text) : {}; } catch { data = { raw_response: text }; }
      if (!response.ok) {
        throw new Error(data.message || data.error || `n8n returned HTTP ${response.status}. Ensure the filter-enabled webhook workflow is active.`);
      }
      if (data.error || data.message === 'Workflow was started') {
        if (data.message === 'Workflow was started') throw new Error('n8n acknowledged the call but did not return the report. Set the Webhook response mode to "Using Respond to Webhook Node".');
      }
      setReport(data);
      setLastUpdated(new Date().toLocaleString());
      setActiveTab('matches');
    } catch (err) {
      setError(`${err.message || err}\n\nCheck that n8n is running, both required webhook workflows are active, and the imported filter-enabled workflow is installed.`);
    } finally {
      setStatus('idle');
    }
  }

  function loadReportFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        setReport(data);
        setLastUpdated(`Loaded from ${file.name}`);
        setError('');
        setStatus('idle');
        setActiveTab('matches');
      } catch {
        setError('That file is not valid JSON. Choose entry-level-job-report.json.');
      }
    };
    reader.readAsText(file);
  }

  function downloadReport() {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'entry-level-job-report.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  const visibleMatchesCount = filteredConfirmed.length + filteredLikely.length;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-symbol"><Icon name="spark" size={21} /></div>
          <div><div className="brand-name">career<span>pilot</span></div><div className="brand-sub">LOCAL AI CAREER AGENT</div></div>
        </div>
        <div className="sidebar-section-label">WORKSPACE</div>
        <button className={`side-nav ${activeTab === 'matches' ? 'active' : ''}`} onClick={() => setActiveTab('matches')}><span className="nav-icon"><Icon name="search" /></span><span>Job matches</span></button>
        <button className={`side-nav ${activeTab === 'companies' ? 'active' : ''}`} onClick={() => setActiveTab('companies')}><span className="nav-icon"><Icon name="globe" /></span><span>Companies</span></button>
        <button className={`side-nav ${activeTab === 'career' ? 'active' : ''}`} onClick={() => setActiveTab('career')}><span className="nav-icon"><Icon name="building" /></span><span>Career pages</span></button>
        <button className={`side-nav ${activeTab === 'review' ? 'active' : ''}`} onClick={() => setActiveTab('review')}><span className="nav-icon"><Icon name="filter" /></span><span>Needs review</span></button>
        <div className="sidebar-spacer" />
        <div className="local-card">
          <div className="local-dot" />
          <div><b>Local AI ready</b><span>Ollama · Qwen 2.5 7B</span></div>
        </div>
        <button className="side-nav side-settings" onClick={() => setShowSettings(v => !v)}><span className="nav-icon">⚙</span><span>Connection settings</span></button>
        <div className="sidebar-foot">Runs on your PC<br />n8n orchestrates · Qwen reasons</div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="mobile-brand"><div className="brand-symbol"><Icon name="spark" size={18}/></div><span>career<span className="brand-accent">pilot</span></span></div>
          <div className="breadcrumb">Workspace <span>/</span> <strong>Job search</strong></div>
          <div className="topbar-actions">
            <span className="connection-pill"><span className="connection-dot" /> Local workflow</span>
            <button className="icon-button" title="Load saved JSON report" onClick={() => reportUpload.current?.click()}><Icon name="upload" /></button>
            <input ref={reportUpload} type="file" accept=".json,application/json" hidden onChange={e => loadReportFile(e.target.files?.[0])} />
          </div>
        </header>

        <section className="page-heading">
          <div>
            <div className="eyebrow"><span className="eyebrow-dot" /> YOUR PERSONAL JOB INTELLIGENCE</div>
            <h1>Find your next opportunity.</h1>
            <p className="lead">Discover relevant roles, compare your experience, and prepare stronger applications.</p>
          </div>
          <button className="button button-primary run-button" onClick={runSearch} disabled={status === 'running'}>
            {status === 'running' ? <><span className="spinner" /> Searching…</> : <><Icon name="search" size={17} /> Search jobs <Icon name="arrow" size={16} /></>}
          </button>
        </section>

        <section className="resume-upload-card">
          <div className="resume-upload-icon"><Icon name="upload" size={20} /></div>
          <div className="resume-upload-copy">
            <div className="upload-title-row"><h2>Candidate resume</h2><span className={`upload-status ${resumeUploadStatus}`}>{resumeUploadStatus === 'success' ? 'Profile ready' : resumeUploadStatus === 'uploading' ? 'Processing' : resumeUploadStatus === 'error' ? 'Upload failed' : 'Local profile'}</span></div>
            <p>{resumeUploadMessage}</p>
            <div className="resume-file-name">{resumeFile ? `${resumeFile.name} · ${(resumeFile.size / 1024).toFixed(0)} KB` : 'PDF only · up to 12 MB · processed using local Qwen'}</div>
          </div>
          <input ref={resumeInput} type="file" accept="application/pdf,.pdf" hidden onChange={e => { setResumeFile(e.target.files?.[0] || null); setResumeUploadStatus('idle'); setResumeUploadMessage(e.target.files?.[0] ? 'Ready to upload. Your PDF will update the local candidate profile.' : 'Upload a PDF resume to refresh the local candidate profile.'); }} />
          <div className="resume-upload-actions"><button className="button button-quiet" onClick={() => resumeInput.current?.click()}><Icon name="upload" size={15}/>{resumeFile || resumeUploadStatus === 'success' ? 'Replace resume' : 'Upload resume'}</button><button className="button button-primary" onClick={uploadResume} disabled={!resumeFile || resumeUploadStatus === 'uploading'}>{resumeUploadStatus === 'uploading' ? <><span className="spinner"/>Processing…</> : 'Update profile'}</button></div>
        </section>

        <section className="filter-panel">
          <button className="filter-panel-toggle" onClick={() => setShowFilters(v => !v)} aria-expanded={showFilters}>
            <span className="filter-panel-title"><span className="filter-panel-icon"><Icon name="sliders" size={18}/></span><span><b>Search preferences</b><small>These settings are sent to n8n and affect the next search.</small></span></span>
            <span className="filter-toggle-right">{showFilters ? 'Hide filters' : 'Edit filters'} <Icon name="chevron" size={16}/></span>
          </button>
          {showFilters && <div className="filter-panel-body">
            <div className="filter-grid primary-filters">
              <label className="field-block"><span>Location(s)</span><input value={filters.locations} onChange={e => setFilter('locations', e.target.value)} placeholder="India, United Kingdom, Germany"/><small>Comma-separated; leave blank for all locations. Remote-country eligibility is still checked on the job page.</small></label>
              <label className="field-block"><span>Work arrangement</span><select value={filters.workMode} onChange={e => setFilter('workMode', e.target.value)}><option value="any">Any arrangement</option><option value="remote">Remote only</option><option value="hybrid">Hybrid only</option><option value="onsite">On-site only</option></select></label>
              <label className="field-block"><span>Maximum required experience</span><select value={filters.experienceMaxYears} onChange={e => setFilter('experienceMaxYears', Number(e.target.value))}><option value={0}>0 years / no experience</option><option value={1}>0–1 years</option><option value={2}>0–2 years</option><option value={3}>0–3 years</option><option value={5}>0–5 years</option><option value={999}>Any experience</option></select></label>
            </div>
            <button className="advanced-filters-toggle" onClick={() => setShowAdvancedFilters(v => !v)} aria-expanded={showAdvancedFilters}>
              <span><Icon name="sliders" size={14}/>{showAdvancedFilters ? 'Hide more filters' : 'More filters'}</span>
              <small>{filters.roleCategories.length} roles · {filters.sources.length} sources · {filters.employmentTypes.length} job types</small>
              <Icon name="chevron" size={15}/>
            </button>
            {showAdvancedFilters && <>
              <div className="filter-grid secondary-filters">
                <label className="field-block"><span>Posted within</span><select value={filters.postedWithinDays} onChange={e => setFilter('postedWithinDays', Number(e.target.value))}><option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option><option value={0}>Any date / unknown</option></select></label>
                <label className="field-block"><span>Jobs to assess with Qwen</span><select value={filters.maxJobsToClassify} onChange={e => setFilter('maxJobsToClassify', Number(e.target.value))}><option value={40}>40 — faster</option><option value={80}>80 — balanced</option><option value={120}>120 — broader, slower</option><option value={150}>150 — widest, slowest</option></select></label>
                <label className="field-block"><span>Minimum salary, when disclosed</span><input type="number" min="0" value={filters.minSalary} onChange={e => setFilter('minSalary', e.target.value)} placeholder="e.g. 60000"/></label>
              </div>
              <div className="filter-section">
                <div className="filter-section-heading"><b>Role families</b><span>Select what you want to apply for.</span></div>
                <div className="choice-grid role-choices">{ROLE_OPTIONS.map(role => <label className="choice-chip" key={role.id}><input type="checkbox" checked={filters.roleCategories.includes(role.id)} onChange={() => toggleFilterItem('roleCategories', role.id)}/><span>{role.label}</span></label>)}</div>
              </div>
              <div className="filter-section two-column-filter">
                <div><div className="filter-section-heading"><b>Employment type</b><span>Leave all selected to include all types.</span></div><div className="choice-grid">{TYPE_OPTIONS.map(type => <label className="choice-chip" key={type.id}><input type="checkbox" checked={filters.employmentTypes.includes(type.id)} onChange={() => toggleFilterItem('employmentTypes', type.id)}/><span>{type.label}</span></label>)}</div></div>
                <div><div className="filter-section-heading"><b>Search sources</b><span>Pick public feeds and/or company career pages.</span></div><div className="choice-grid source-choices">{SOURCE_OPTIONS.map(source => <label className="choice-chip" key={source.id}><input type="checkbox" checked={filters.sources.includes(source.id)} onChange={() => toggleFilterItem('sources', source.id)}/><span>{source.label}</span></label>)}</div></div>
              </div>
              <div className="filter-grid keyword-filters">
                <label className="field-block"><span>Include keywords</span><input value={filters.includeKeywords} onChange={e => setFilter('includeKeywords', e.target.value)} placeholder="Python, PostgreSQL, FastAPI"/><small>Comma-separated; a listing must include at least one.</small></label>
                <label className="field-block"><span>Exclude keywords</span><input value={filters.excludeKeywords} onChange={e => setFilter('excludeKeywords', e.target.value)} placeholder="Senior, unpaid, commission"/><small>Listings containing any excluded term are removed.</small></label>
              </div>
              <div className="filter-bottom-row">
                <label className="toggle-option"><input type="checkbox" checked={filters.salaryOnly} onChange={e => setFilter('salaryOnly', e.target.checked)}/><span><b>Only show roles with salary listed</b><small>Unpaid or undisclosed listings can be hidden.</small></span></label>
                <label className="toggle-option"><input type="checkbox" checked={filters.includeRemoteWithUnknownLocation} onChange={e => setFilter('includeRemoteWithUnknownLocation', e.target.checked)}/><span><b>Include remote jobs with unclear country eligibility</b><small>These will be labelled for manual verification.</small></span></label>
                <button className="button button-quiet reset-filters" onClick={() => setFilters(DEFAULT_FILTERS)}>Reset filters</button>
              </div>
            </>}
            <div className="filter-actions"><span className="active-filter-summary">{filters.locations || 'All locations'} · {filters.workMode === 'any' ? 'Any arrangement' : filters.workMode} · {filters.experienceMaxYears === 999 ? 'Any experience' : `0–${filters.experienceMaxYears} years`} · {filters.roleCategories.length} role families · {filters.sources.length} sources</span></div>
          </div>}
        </section>

        {showSettings && (
          <section className="settings-panel">
            <div className="settings-copy"><strong>n8n webhook path</strong><span>Usually this stays on the local Vite proxy. Activate the imported webhook workflow in n8n before running searches.</span></div>
            <input value={webhookPath} onChange={e => setWebhookPath(e.target.value)} />
            <button className="button button-quiet" onClick={() => setWebhookPath(API_PATH)}>Reset</button>
          </section>
        )}

        {status === 'running' && (
          <div className="running-banner">
            <div className="spinner large" />
            <div><b>Your search is running</b><p>Checking public job feeds and company career boards, then asking Qwen to classify experience requirements. Local 7B inference can take a few minutes.</p></div>
          </div>
        )}
        {error && <div className="error-banner"><Icon name="warning" size={20}/><div><b>Could not complete the search</b><pre>{error}</pre><p>To start from existing results, click the upload icon in the top bar and choose <code>entry-level-job-report.json</code>.</p></div></div>}

        {report ? (
          <>
            <section className="stats-grid">
              <div className="stat-card"><span>Jobs found</span><div>{stats.prefilter_relevant_jobs_found ?? report.prefilter_relevant_jobs_found ?? '—'}</div></div>
              <div className="stat-card green"><span>Confirmed roles</span><div>{stats.confirmed_0_to_1_years_count ?? safeArray(report.confirmed_0_to_1_years_jobs || report.eligible_jobs).length}</div></div>
              <div className="stat-card amber"><span>Entry-level to verify</span><div>{stats.likely_entry_level_review_count ?? safeArray(report.likely_entry_level_jobs_for_manual_verification || report.likely_entry_level_jobs).length}</div></div>
              <div className="stat-card"><span>Companies discovered</span><div>{allFeedCompanies.length || '—'}</div></div>
            </section>

            <section className="content-toolbar">
              <div>
                <h2>{activeTab === 'career' ? 'Company career pages' : activeTab === 'companies' ? 'Companies discovered' : activeTab === 'review' ? 'Roles that need a closer look' : 'Your shortlist'}</h2>
                <p>{activeTab === 'career' ? 'Direct links to configured company career pages, including boards whose API could not be queried.' : activeTab === 'companies' ? 'Companies returned by public job feeds. A direct career URL appears when the feed provides one.' : activeTab === 'review' ? 'Roles where the experience requirement wasn’t conclusive. Verify it on the employer site.' : 'Confirmed roles first, then likely entry-level listings to manually verify.'}</p>
              </div>
              <div className="toolbar-controls">
                <label className="search-box"><Icon name="search" size={16}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search titles or companies…" /></label>
                <label className="select-box"><Icon name="filter" size={15}/><select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}><option value="all">All sources</option>{sourceOptions.map(s => <option key={s} value={s}>{s}</option>)}</select></label>
                <label className="remote-toggle"><input type="checkbox" checked={onlyRemote} onChange={e => setOnlyRemote(e.target.checked)}/> Remote only</label>
              </div>
            </section>

            {activeTab === 'matches' && (
              <div className="results-layout">
                <div className="results-main">
                  <div className="section-heading"><span className="section-number">01</span><div><h3>Confirmed within selected experience range</h3><p>Experience requirement is consistent with the maximum you selected; verify it on the original posting.</p></div><span className="section-total">{filteredConfirmed.length}</span></div>
                  {filteredConfirmed.length ? filteredConfirmed.map(j => <JobCard key={j.job_id || j.application_link} job={j}/>) : <div className="empty-inline"><Icon name="check" size={18}/><div><b>No confirmed roles in this run</b><span>The filter is strict. Check the entry-level review section below rather than assuming no companies are hiring.</span></div></div>}
                  <div className="section-heading separated"><span className="section-number amber-num">02</span><div><h3>Likely entry-level — verify before applying</h3><p>Good early-career signals were found, but the posted experience line needs human verification.</p></div><span className="section-total">{filteredLikely.length}</span></div>
                  {filteredLikely.length ? filteredLikely.map(j => <JobCard key={j.job_id || j.application_link} job={j}/>) : <div className="empty-inline"><Icon name="clock" size={18}/><div><b>No listings in this category</b><span>Try refreshing the search or browse company career pages.</span></div></div>}
                </div>
                <aside className="results-side">
                  <div className="side-card">
                    <div className="side-card-head"><div className="side-card-icon"><Icon name="spark" /></div><div><h3>Search strategy</h3><p>How CareerPilot screens roles</p></div></div>
                    <div className="strategy-step"><span>1</span><div><b>Role fit</b><p>Backend, Python, Java, data, AI/LLM, QA automation and developer tooling.</p></div></div>
                    <div className="strategy-step"><span>2</span><div><b>Experience</b><p>Confirmed 0–1 year roles are separated from likely entry-level ones.</p></div></div>
                    <div className="strategy-step"><span>3</span><div><b>Human check</b><p>Verify location restrictions, current status, and required years before applying.</p></div></div>
                    <button className="button button-quiet full-button" onClick={() => setActiveTab('career')}>Browse career pages <Icon name="arrow" size={15}/></button>
                  </div>
                  <div className="side-card blue-card"><div className="blue-kicker">LOCAL AI STACK</div><h3>Private by design.</h3><p>Qwen runs through Ollama on your PC. The search does call public job-source APIs to retrieve current listings.</p><div className="stack-pills"><span>n8n</span><span>Ollama</span><span>Qwen 2.5 7B</span></div></div>
                  <div className="side-card"><h3>Download report</h3><p className="muted-text">Save the full JSON, including career pages and application drafts, for later review.</p><button className="button button-primary full-button" onClick={downloadReport}><Icon name="file" size={16}/> Download JSON report</button></div>
                </aside>
              </div>
            )}

            {activeTab === 'career' && (
              <div className="career-list">
                <div className="list-hero"><div className="list-hero-icon"><Icon name="building" size={22}/></div><div><h3>{allCareerBoards.length} career boards in this run</h3><p>Some boards respond with roles; some need manual browsing. Both remain visible.</p></div></div>
                {allCareerBoards.length ? allCareerBoards.map((b, i) => <CareerPageCard board={b} key={`${b.ats}-${b.board_token}-${i}`}/>) : <div className="empty-inline"><div><b>No career-page records in this report</b><span>Import a report generated by the webhook-enabled workflow v2.</span></div></div>}
              </div>
            )}

            {activeTab === 'companies' && (
              <div className="career-list">
                <div className="list-hero"><div className="list-hero-icon"><Icon name="globe" size={22}/></div><div><h3>{allFeedCompanies.length} companies discovered</h3><p>These are companies returned by the public job feeds, not an exhaustive worldwide employer directory.</p></div></div>
                {allFeedCompanies.length ? allFeedCompanies.map((c, i) => <CompanyRow item={c} key={`${c.company}-${i}`}/>) : <div className="empty-inline"><div><b>No feed companies in this report</b><span>Run the updated workflow to populate this list.</span></div></div>}
              </div>
            )}

            {activeTab === 'review' && (
              <div className="results-main review-list">
                {filteredManual.length ? filteredManual.map(j => <JobCard key={j.job_id || j.application_link} job={j}/>) : <div className="empty-state"><div className="empty-icon"><Icon name="check" size={26}/></div><h3>No uncertain roles to review</h3><p>Either all returned roles were classified or no manual-review roles were included in this report.</p></div>}
              </div>
            )}

            <div className="footer-note"><Icon name="warning" size={15}/><span>CareerPilot never marks an application as submitted. Review the official posting, work location eligibility, and each draft before applying.</span></div>
          </>
        ) : (
          <div className="welcome-grid">
            <div className="welcome-main">
              <div className="welcome-badge"><Icon name="spark" size={14}/> WORKFLOW READY TO RUN</div>
              <h2>One search. A clearer starting point.</h2>
              <p>Upload a resume, choose your preferred locations, roles, job types and sources, then run the search. CareerPilot keeps confirmed matches separate from jobs that need a closer look.</p>
              <div className="welcome-actions"><button className="button button-primary" onClick={runSearch} disabled={status === 'running'}><Icon name="search" size={17}/> Start search</button><button className="button button-quiet" onClick={() => reportUpload.current?.click()}><Icon name="upload" size={16}/> Load existing report</button></div>
              <div className="workflow-prereq"><div className="prereq-icon"><Icon name="check" size={16}/></div><div><b>Before you run it</b><span>n8n + Ollama running · upload a PDF or keep your saved candidate profile</span></div></div>
            </div>
            <div className="welcome-side">
              <div className="welcome-side-head"><div className="side-card-icon"><Icon name="globe"/></div><div><h3>Global sources</h3><p>Public feeds plus direct ATS career boards</p></div></div>
              {initialSources.map(s => <div className="welcome-source" key={s.name}><div><b>{s.name}</b><span>{s.kind}</span></div><span className="source-check">Included</span></div>)}
              <div className="welcome-bottom"><Icon name="clock" size={15}/> A complete run can take several minutes on a local 7B model.</div>
            </div>
          </div>
        )}
        <footer className="app-footer"><span>CAREERPILOT / LOCAL AI</span><span>n8n orchestrates. Qwen evaluates. You decide.</span></footer>
      </main>
    </div>
  );
}
