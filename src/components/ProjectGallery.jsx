import { useState } from 'react';
import { LayoutGrid, Rocket, History, ArrowUpRight, ShieldCheck } from 'lucide-react';

const projects = [
  // PAST PROJECTS
  { id: '101', name: 'Panchratna Galleria', category: 'Foundation', status: 'Delivered', img: '/images/101.jpg', desc: 'The iconic commercial headquarters at Sarjana Chowk.' },
  { id: '102', name: 'Panchratna Avenue', category: 'Foundation', status: 'Delivered', img: '/images/102.jpg', desc: 'Precision-engineered residential hub in Morabadi.' },
  { id: '103', name: 'Panchratna Keshri', category: 'Foundation', status: 'Delivered', img: '/images/103.jpg', desc: 'High-density structural integrity in Upper Bazar.' },
  
  // PRESENT PROJECTS
  { id: '201', name: 'Panchratna Altius', category: 'Rising', status: 'Active', img: '/images/201.jpg', desc: 'Ranchi’s 16-floor luxury pinnacle on Main Road.' },
  { id: '202', name: 'Panchratna Heritage', category: 'Rising', status: 'Active', img: '/images/202.jpg', desc: '2 acres of sustainable luxury living in Bariatu.' },
  { id: '203', name: 'Panchratna Armonia', category: 'Rising', status: 'Active', img: '/images/203.jpg', desc: 'Boutique architectural masterpiece in Hindpiri.' },
  { id: '204', name: 'Panchratna Gyanodaya', category: 'Rising', status: 'Active', img: '/images/204.jpg', desc: 'Tech-forward residential hub with EV infrastructure.' },

  // FUTURE PROJECTS
  { id: '301', name: 'Sarawgi Elitus', category: 'Horizon', status: 'Launch', img: '/images/301.jpg', desc: 'Upcoming 13-floor sanctuary on Kanke Road.' },
  { id: '302', name: 'Pareek Square', category: 'Horizon', status: 'Vision', img: '/images/302.jpg', desc: 'Next-gen high-density urban development.' },
  { id: '303', name: 'Synergy One', category: 'Horizon', status: 'Vision', img: '/images/303.jpg', desc: 'The future of Ranchi’s ultra-modern skyline.' },
];

export default function ProjectGallery() {
  const [filter, setFilter] = useState('Rising');

  const categories = [
    { name: 'Foundation', label: 'Delivered Legacy', icon: History },
    { name: 'Rising', label: 'Current Skyline', icon: LayoutGrid },
    { name: 'Horizon', label: 'Future Vision', icon: Rocket },
  ];

  return (
    <section id="skyline-portfolio" className="py-24 bg-[#FDFBF7] relative z-10 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[#115E59] text-xs font-semibold uppercase tracking-wider">
              Skyline Portfolio
            </div>
            <h2 className="text-3xl md:text-5xl font-black text-[#1E293B] tracking-tight uppercase">
              Our Architectural <span className="text-gradient-neon">Footprint</span>
            </h2>
          </div>

          {/* Filter Tabs - Minimal Anti-Gravity Style */}
          <div className="flex bg-[#F9F6F0] p-1.5 rounded-2xl border border-[#EAE5DC] self-start md:self-auto">
            {categories.map((cat) => (
              <button
                key={cat.name}
                onClick={() => setFilter(cat.name)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  filter === cat.name 
                    ? 'bg-[#115E59] text-white shadow-md' 
                    : 'text-[#64748B] hover:text-[#115E59]'
                }`}
              >
                <cat.icon className="w-3.5 h-3.5" />
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Gallery Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {projects.filter(p => p.category === filter).map((project) => (
            <div 
              key={project.id} 
              className="group relative glassmorphism rounded-3xl overflow-hidden transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl"
            >
              {/* Image Container */}
              <div className="aspect-[4/5] overflow-hidden bg-slate-100 relative">
                <img 
                  src={project.img} 
                  alt={project.name} 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1A2421]/90 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity"></div>
                
                {/* Status Badge Overlay */}
                <div className="absolute top-4 left-4 flex gap-2">
                  <span className="px-3 py-1 bg-white/90 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest text-[#115E59] border border-white shadow-sm">
                    {project.status}
                  </span>
                  {project.category === 'Rising' && (
                    <span className="px-3 py-1 bg-[#115E59] rounded-full text-[10px] font-black uppercase tracking-widest text-white flex items-center gap-1 shadow-sm">
                      <ShieldCheck className="w-3 h-3" /> JHARERA
                    </span>
                  )}
                </div>
              </div>

              {/* Content Overlay */}
              <div className="p-6 space-y-2 relative bg-white">
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-extrabold text-xl text-[#1E293B] uppercase tracking-tight group-hover:text-[#115E59] transition-colors">
                    {project.name}
                  </h3>
                  <ArrowUpRight className="w-5 h-5 text-[#D6CFC4] group-hover:text-[#115E59] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                </div>
                <p className="text-sm text-[#64748B] leading-relaxed">
                  {project.desc}
                </p>
                <div className="pt-2 border-t border-[#F9F6F0] flex items-center justify-between text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest">
                  <span>Ranchi, Jharkhand</span>
                  <span className="text-[#115E59]">View Details</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
   }
    
