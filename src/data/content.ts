// Resume content shown in the panels. Sections marked TODO are intentional
// placeholders — fill them in and the UI will pick them up automatically.

export interface EducationEntry {
  school: string;
  program: string;
  dates: string;
  bullets: string[];
  tags: string[];
  coursework: string[];
}

export interface ExperienceEntry {
  org: string;
  role: string;
  dates: string;
  bullets: string[];
  tags: string[];
}

export interface ProjectEntry {
  name: string;
  meta: string;
  bullets: string[];
  tags: string[];
  /**
   * The public repo, if the work has one. Stated as the browsable page rather
   * than the `.git` clone URL — this is a link a reader follows, not one a
   * client clones. Optional: the rent analysis has no repo to point at, and
   * the panel simply omits the mark for it.
   */
  repo?: string;
}

export interface ExtracurricularEntry {
  org: string;
  role: string;
  bullets: string[];
  tags: string[];
}

export interface InterestEntry {
  label: string;
  icon: string;
}

export interface TechStackGroup {
  label: string;
  blurb: string;
  items: string[];
}

/**
 * The overview the book on the mansion table opens with — the one place on the
 * site that speaks in Sam's own voice rather than in resume bullets. One string
 * per paragraph.
 */
export const RUNDOWN: string[] = [
  "Hello, and thank you for visiting my walkable portfolio. I graduated UCLA with a B.S. in Statistics and Data Science, and recently joined Turner and Townsend, a construction consulting company, as an AI Engineer.",
  "Already this job has led me to explore AI capabilities outside the scope of my work, and has challenged me to up-skill myself. This website is the first of many projects I will have explored adjacent to my professional life. Building this has been one of the most rewarding experiences of my life, and I hope you enjoy it!",
];

export const EDUCATION: EducationEntry[] = [
  {
    school: "University of California, Los Angeles",
    program: "B.S. Statistics & Data Science",
    dates: "Sep 2022 – Jun 2026",
    bullets: [
      "Strong foundation in probability and statistical modeling through project work",
      "Focus on machine learning, analytics, and data-driven decision making",
      "Real-world datasets used with R and Python to perform modern modeling techniques",
    ],
    tags: ["Machine Learning", "R", "Python", "Probability", "Modeling", "Sampling"],
    coursework: [
      "Calculus of Several Variables",
      "Statistical Reasoning",
      "Linear Algebra and Applications",
      "Programming With R",
      "Differential Equations",
      "Data Analysis and Regression",
      "Computational Statistics With R",
      "Data Science For Social Good",
      "Design and Analysis of Experiments",
      "Regression and Data Mining",
      "Monte Carlo Methods",
      "Text Mining Using R",
      "Practice of Statistical Consulting",
    ],
  },
  {
    school: "Universidad Carlos III de Madrid",
    program: "Semester Abroad",
    dates: "Aug 2024 – Dec 2024",
    bullets: [
      "Completed advanced coursework in statistical learning and applied data science",
      "Developed interpretable predictive models for projects and evaluated performance",
    ],
    tags: ["Machine Learning", "R", "Modeling", "Probability"],
    coursework: ["Statistical Learning", "Probability and Data Analysis"],
  },
  {
    school: "Tamalpais High School",
    program: "High School Diploma",
    dates: "Sep 2018 – Jun 2022",
    bullets: [
      "Graduated with a 4.67 GPA, earning an A or higher in every course taken across four years",
      "Varsity Athlete in four sports; football, soccer, lacrosse, and track, balancing year-round training and competition with a full academic course load",
      "Served as a Link Leader, mentoring incoming freshmen through their transition to high school by leading orientation activities and providing ongoing academic and social guidance",
    ],
    // The same four the rugby entry carries, for the same reasons — a
    // four-sport athlete holding a full course load is that entry's story told
    // earlier — plus Mentorship, which is the whole of the Link Leader bullet
    // and the one thing Leadership on its own does not say: leading a group
    // and bringing one person along behind you are different jobs.
    tags: ["Leadership", "Mentorship", "Teamwork", "Discipline", "Time Management"],
    // Empty on purpose rather than filled with a guess at four years of
    // timetable. `EducationContent` only draws the coursework collapsible when
    // there is something in it, so the card simply goes without.
    coursework: [],
  },
];

export const EXPERIENCE: ExperienceEntry[] = [
  // TODO(sam): fill in role, dates, and bullets. Until `bullets` is non-empty
  // the panel renders the work-in-progress note instead of an empty card.
  {
    org: "Turner & Townsend",
    role: "",
    dates: "",
    bullets: [],
    tags: [],
  },
  {
    org: "Innovius Capital",
    role: "Data Science Intern",
    dates: "Jan 2026 – Mar 2026",
    bullets: [
      "Automated a classification pipeline to scrape and analyze company websites",
      "Classifier determined strategic alignment with Innovius investment strategy",
      "Optimized an LLM and rule-based ensemble model leveraging text anchors",
      "Achieved 72% precision, 91% recall, and 70% accuracy on a ground-truth labeled dataset",
      "Containerized model outputs on AWS, utilizing Amazon S3 for scalable storage",
      "Deployed workflow with AWS EventBridge and AWS Batch, enabling downstream analytics",
    ],
    tags: ["Python", "AWS S3", "AWS EventBridge", "AWS Batch", "OpenAI SDK", "Claude SDK", "NLP"],
  },
  {
    org: "Popcorn.co",
    role: "Data Analytics / Data Engineering Intern",
    dates: "Jun 2025 – Sep 2025",
    bullets: [
      "Architected and deployed a customer data platform to surface actionable product KPIs",
      "Led cohort, funnel, retention, and conversion analyses to identify high-value functionality",
      "Built tracking functions across frontend and backend systems processing 600k+ API calls",
      "Ensured end-to-end data pipeline integrity by locating and resolving discrepancies",
      "Collaborated with engineers and product managers on data-driven UI decisions",
      "Applied prompt engineering techniques to train the AI moviemaking agent",
    ],
    tags: ["Python", "TypeScript", "Figma", "Amplitude", "Cursor"],
  },
  {
    org: "DTEX Systems",
    role: "Data Science Intern",
    dates: "Jun 2024 – Aug 2024",
    bullets: [
      "Developed anomaly detection methods across datasets with 10M+ observations",
      "Applied NLP and clustering techniques to extract structure from window-title strings",
      "Built preprocessing pipelines critical for multidimensional behavioral analysis",
      "Focused on interpretability and actionable insights in a cybersecurity context",
    ],
    tags: ["Python", "NLP", "Clustering", "Machine Learning"],
  },
  {
    org: "Associated Students, UCLA",
    role: "Distribution Specialist",
    dates: "Aug 2023 – Jun 2024",
    bullets: [
      "Coordinated distribution of equipment to student organizations and campus partners",
      "Worked closely with team members to ensure efficient operations and logistics",
      "Developed communication and organizational skills in a fast-paced environment",
    ],
    tags: ["Operations", "Teamwork", "Organization"],
  },
];

export const PROJECTS: ProjectEntry[] = [
  {
    name: "Predicting Municipal Voter Turnout in Quincy, MA",
    meta: "Statistical Consulting (Classification and Predictive Modeling) — Python — Apr 2026 – Jun 2026",
    bullets: [
      "Modeled local election non-voting for a civic-engagement client using a 33,315-record L2 Data voter file",
      "Engineered eligibility-adjusted turnout rates and federal-only voter indicators from 900 raw variables",
      "Compared logistic regression, random forest, and boosting models using stratified cross-validation",
      "Delivered an 18-predictor XGBoost model (0.90 recall, 0.80 AUC) tiering voters into outreach priority groups",
    ],
    tags: ["Python", "Feature Engineering", "Random Forest", "Boosting", "Model Evaluation"],
    repo: "https://github.com/Samuel-Reade/asymmetric-voter-turnout",
  },
  {
    name: "Predicting Extreme Durability of Rolled-Formed Aluminum",
    meta: "Kaggle Competition (Regression and Data Mining) — Python / R — Nov 2025 – Dec 2025",
    bullets: [
      "Built and evaluated boosting models to predict durability with 160,000+ production records",
      "Performed EDA and feature engineering on industrial process variables",
      "Optimized models using cross-validation and log-loss minimization to improve results",
      "Achieved 9th place in the Kaggle competition by tuning the final CatBoost model",
    ],
    tags: ["Python", "R", "Feature Engineering", "Boosting"],
    repo: "https://github.com/Samuel-Reade/Predicting-Extreme-Durability-of-Rolled-Formed-Aluminum",
  },
  {
    name: "ASA DataFest 2025",
    meta: "Hackathon — Python / R — May 2025",
    bullets: [
      "Analyzed 194,685 office lease transactions across 29 U.S. markets during competition",
      "Designed an interactive tool to streamline client decision-making for office relocation",
      "Built data visualizations to surface insights on where, when, and how companies relocate",
      "Delivered a presentation to Savills executives, translating market analysis into guidance",
    ],
    tags: ["Clustering", "Product Design", "Random Forest", "Time Series"],
    repo: "https://github.com/Samuel-Reade/Data-Fest-UCLA-2025",
  },
  {
    name: "A Case Study of COVID-19 Social Media Posts",
    meta: "Data Science for Social Good — Python — May 2025 – Jun 2025",
    bullets: [
      "Preprocessed and analyzed 10,700 COVID-19 social media posts",
      "Applied tokenization, stopword filtering, and TF-IDF vectorization",
      "Built a Random Forest classifier achieving 94% accuracy detecting misinformation",
      "Leveraged SHAP and permutation importance to interpret model behavior",
    ],
    tags: ["Python", "NLP", "Random Forest", "Factor Analysis"],
    repo: "https://github.com/Samuel-Reade/Understanding-Misinformation-A-Case-Study-of-COVID-19-Social-Media-Posts",
  },
  {
    name: "How Exercise Affects Cortisol Experiment",
    meta: "Design and Analysis of Experiments — R — May 2025 – Jun 2025",
    bullets: [
      "Designed a randomized complete block experiment with a simulated population",
      "Collected and analyzed 180 cortisol measurements across 90 participants",
      "Ran ANOVA, post-hoc comparisons, diagnostics, and power analyses",
      "Validated assumptions and flagged potential nuisance variables",
    ],
    tags: ["R", "Experimental Design", "Statistical Testing", "ANOVA"],
    repo: "https://github.com/Samuel-Reade/How-Exercise-Effects-Cortisol-Levels-Experiment",
  },
  {
    name: "Predicting Success of Netflix Movies",
    meta: "Statistical Learning — R — Nov 2024 – Dec 2024",
    bullets: [
      "Cleaned and engineered features from a dataset of 32,540 movies",
      "Defined a profit-based success metric for classification",
      "Built Bayesian classifiers and ensemble methods",
      "Achieved 79% average accuracy with cross-validation",
    ],
    tags: ["R", "Bayesian Modeling", "Ensemble Methods", "Model Evaluation", "Machine Learning"],
    repo: "https://github.com/Samuel-Reade/Predicting-Success-of-Netflix-Movies",
  },
];

// Grouped rather than one flat wall of pills — a single list of ~60 tools reads
// as noise, and the grouping is what says *how* each tool gets used. Every item
// here is something used in the work above (or in this site itself), so entries
// stay in sync with EXPERIENCE / PROJECTS when those change.
export const TECH_STACK: TechStackGroup[] = [
  {
    label: "Languages",
    blurb: "Day-to-day working languages, statistics through to the browser",
    items: ["Python", "R", "SQL", "TypeScript", "JavaScript", "HTML / CSS", "GLSL"],
  },
  {
    label: "Data Science & Machine Learning",
    blurb: "Modeling, evaluation, and interpretation on real-world datasets",
    items: [
      "pandas",
      "NumPy",
      "scikit-learn",
      "Jupyter",
      "CatBoost",
      "XGBoost",
      "Gradient Boosting",
      "Random Forest",
      "Clustering (k-means, GMM, PAM)",
      "PCA & Factor Analysis",
      "Bayesian Modeling",
      "Anomaly Detection",
      "NLP & TF-IDF",
      "SHAP",
      "Cross-Validation",
      "Experimental Design & ANOVA",
      "Monte Carlo Methods",
      "Time Series",
    ],
  },
  {
    label: "AI & LLM Engineering",
    blurb: "Building with models — pipelines, agents, prompt design, and generation",
    items: [
      "OpenAI SDK",
      "Claude SDK",
      "LangChain",
      "Prompt Engineering",
      "LLM + Rule-Based Ensembles",
      "Higgsfield",
      "Cursor",
      "Claude Code",
    ],
  },
  {
    label: "Web & Application Development",
    blurb: "Front-end and API work, including the 3D world you're standing in",
    items: [
      "React",
      "Vue",
      "Vite",
      "FastAPI",
      "React Three Fiber",
      "Three.js",
      "drei",
      "Zustand",
      "Base44",
      "Lovable",
    ],
  },
  {
    label: "Cloud, Infrastructure & Deployment",
    blurb: "Getting pipelines and products off a laptop and into production",
    items: [
      "AWS S3",
      "AWS Batch",
      "AWS EventBridge",
      "Azure",
      "Terraform",
      "Vercel",
      "Docker",
      "CI/CD",
      "Containerization",
      "Git & GitHub",
    ],
  },
  {
    label: "Product & Analytics",
    blurb: "Turning behavior data into decisions, and decisions into interfaces",
    items: [
      "Amplitude",
      "Figma",
      "Cohort & Funnel Analysis",
      "Retention & Conversion Analysis",
      "Event Tracking Instrumentation",
      "Data Visualization",
      "A/B & Experiment Readouts",
    ],
  },
];

export const EXTRACURRICULARS: ExtracurricularEntry[] = [
  {
    org: "Statistics & Data Science Club",
    role: "UCLA — Member",
    bullets: [
      "Participated in workshops and events focused on applied data science",
      "Collaborated with peers to explore real-world datasets and modeling techniques",
      "Strengthened technical foundations through hands-on learning outside of coursework",
    ],
    tags: ["Data Science", "Statistics", "Machine Learning", "Teamwork"],
  },
  // TODO(sam): fill in role and bullets. Until `bullets` is non-empty the panel
  // renders the work-in-progress note instead of an empty card — the balloon for
  // it on the Associations hill is already built and openable.
  {
    org: "Olympic Club Rugby",
    role: "",
    bullets: [],
    tags: [],
  },
  {
    org: "UCLA Rugby",
    role: "Student-Athlete",
    bullets: [
      "Competed at the Division 1 level while balancing academic commitments",
      "Developed discipline, resilience, and teamwork skills through intense training",
      "Captained multiple tournaments, leading the team to two 2nd place finishes",
    ],
    tags: ["Teamwork", "Leadership", "Discipline", "Time Management"],
  },
  {
    org: "Lambda Chi Alpha Fraternity",
    role: "UCLA — Social Chairman / Academic Chairman",
    bullets: [
      "Planned and facilitated all social events with event companies while managing $100,000+",
      "Facilitated and maintained academic excellence resulting in a top-5 average fraternity GPA",
      "Strengthened communication and interpersonal skills in a team-based environment",
    ],
    tags: ["Leadership", "Budgeting", "Collaboration"],
  },
];

export const INTERESTS: InterestEntry[] = [
  { label: "Travel", icon: "✈️" },
  { label: "Skiing", icon: "⛷️" },
  { label: "Ancient History", icon: "🏛️" },
  { label: "One Piece", icon: "🏴‍☠️" },
  { label: "Reading", icon: "📚" },
  { label: "Film", icon: "🎬" },
  { label: "Stellar Masses", icon: "🌌" },
  { label: "Sports", icon: "🏉" },
  { label: "LEGO", icon: "🧱" },
  { label: "Archery", icon: "🏹" },
];
