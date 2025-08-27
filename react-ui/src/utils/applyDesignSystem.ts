// Utility to apply new design system consistently across all pages

export const designSystemClasses = {
  // Page wrapper
  pageWrapper: "min-h-screen bg-imersa-void relative overflow-hidden",
  
  // Ambient background
  ambientBg: `
    <div className="ambient-bg">
      <div className="ambient-orb ambient-orb-1"></div>
      <div className="ambient-orb ambient-orb-2"></div>
      <div className="ambient-orb ambient-orb-3"></div>
    </div>
  `,
  
  // Content wrapper
  contentWrapper: "relative z-10 p-8 space-y-6",
  
  // Header card
  headerCard: "glass-card p-6",
  
  // Button styles
  buttonPrimary: "btn-glow flex items-center gap-2",
  buttonSecondary: "px-4 py-2 rounded-xl bg-imersa-surface border border-gray-700 text-gray-300 hover:border-imersa-glow-primary transition-all",
  buttonGhost: "p-2 rounded-lg bg-white/10 hover:bg-white/20 text-gray-400 transition-all",
  
  // Input styles
  inputField: "w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500",
  
  // Card styles
  card: "glass-card",
  cardHolo: "glass-card holo-card",
  cardLight: "glass-card light-beam",
  
  // Text styles
  heading: "text-3xl font-bold text-white",
  subheading: "text-gray-400",
  
  // Icon wrapper
  iconOrb: "nav-orb",
  
  // Loading
  loading: "loading-pulse",
};

export const getPageTemplate = (icon: string, title: string, subtitle: string) => `
  <div className="${designSystemClasses.pageWrapper}">
    ${designSystemClasses.ambientBg}
    
    <div className="${designSystemClasses.contentWrapper}">
      {/* Header */}
      <div className="${designSystemClasses.headerCard}">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="${designSystemClasses.iconOrb}">
              <${icon} className="w-8 h-8 text-imersa-dark" />
            </div>
            <div>
              <h1 className="${designSystemClasses.heading}">${title}</h1>
              <p className="${designSystemClasses.subheading}">${subtitle}</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Content */}
    </div>
  </div>
`;