import React, { useState, useEffect, useCallback } from "react";
import { Outlet } from "react-router-dom";
import { MdOutlineAutoAwesome } from "react-icons/md";
import { FiTrendingUp, FiShield, FiPieChart, FiPackage, FiChevronLeft, FiChevronRight, FiHeart } from "react-icons/fi";

export default function AuthLayout() {
    const [currentSlide, setCurrentSlide] = useState(0);

    // Data Konten Slide Eksklusif Byutie Store
    const slides = [
        {
            title: "Elevate Your Beauty Business",
            description: "Transformasi manajemen toko kecantikan Anda dengan analitik penjualan yang akurat dan real-time.",
            badge: "Management Intelligence",
            icon: <FiPieChart />,
            color: "from-[#B01030] to-[#7a081f]"
        },
        {
            title: "Advanced Inventory & Logistics",
            description: "Pantau stok produk kecantikan dan supplier secara otomatis. Hilangkan risiko kehabisan stok barang.",
            badge: "Smart Logistics",
            icon: <FiPackage />,
            color: "from-[#7a081f] to-[#4d0514]"
        },
        {
            title: "Premium Security Protocols",
            description: "Keamanan data pelanggan dan laporan keuangan Anda terlindungi dengan enkripsi berlapis standar industri.",
            badge: "Enterprise Security",
            icon: <FiShield />,
            color: "from-[#4d0514] to-[#B01030]"
        }
    ];

    // Fungsi navigasi manual
    const nextSlide = useCallback(() => {
        setCurrentSlide((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
    }, [slides.length]);

    const prevSlide = () => {
        setCurrentSlide((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
    };

    // Logic Auto Slide 3 Detik
    useEffect(() => {
        const timer = setInterval(() => {
            nextSlide();
        }, 3000);
        return () => clearInterval(timer);
    }, [nextSlide]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#F1F3F9] p-4 lg:p-10 font-nunito bg-[radial-gradient(#d1d5db_1.2px,transparent_1.2px)] [background-size:24px_24px]">
            
            {/* MAIN CONTAINER */}
            <div className="bg-white rounded-[3rem] shadow-[0_40px_80px_-15px_rgba(0,0,0,0.12)] w-full max-w-7xl flex flex-col lg:flex-row overflow-hidden border border-white/60 relative">
                
                {/* ========================================= */}
                {/* BAGIAN KIRI: AUTHENTICATION FORM AREA       */}
                {/* ========================================= */}
                <div className="w-full lg:w-[40%] p-10 lg:p-16 flex flex-col justify-between relative z-20 bg-white">
                    <div>
                        {/* Elegant Logo */}
                        <div className="flex items-center gap-3 mb-12 group">
                            <div className="bg-gradient-to-br from-[#B01030] to-[#7a081f] p-3 rounded-2xl shadow-lg shadow-red-100 group-hover:rotate-12 transition-transform duration-500">
                                <MdOutlineAutoAwesome className="text-white text-3xl" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-black text-gray-900 tracking-tighter leading-none">
                                    byutie<span className="text-[#B01030]">.</span>
                                </h1>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.3em] mt-1">Management Pro</p>
                            </div>
                        </div>

                        {/* Outlet Form (Login/Register) */}
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                            <Outlet />
                        </div>
                    </div>

                    {/* Footer Info */}
                    <div className="mt-12 pt-8 border-t border-gray-50 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">System Active</span>
                        </div>
                        <p className="text-[11px] font-bold text-gray-300 tracking-tight">
                            © 2026 BYUTIE STORE • V 2.4.0
                        </p>
                    </div>
                </div>


                {/* ========================================= */}
                {/* BAGIAN KANAN: INTERACTIVE PREMIUM CAROUSEL  */}
                {/* ========================================= */}
                <div className="hidden lg:flex lg:w-[60%] relative overflow-hidden group/carousel">
                    
                    {/* Background Transitions */}
                    {slides.map((s, i) => (
                        <div 
                            key={i}
                            className={`absolute inset-0 bg-gradient-to-br ${s.color} transition-all duration-1000 ease-in-out transform ${currentSlide === i ? 'opacity-100 scale-100' : 'opacity-0 scale-110'}`}
                        />
                    ))}

                    {/* Aesthetic Overlays */}
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
                    <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_70%_30%,rgba(255,255,255,0.15),transparent_70%)]"></div>

                    {/* INTERACTIVE ELEMENTS */}
                    <div className="relative z-10 w-full h-full p-20 flex flex-col justify-between">
                        
                        {/* 1. TOP PROGRESS BAR (Static Position, Dynamic Fill) */}
                        <div className="flex gap-4 mb-20">
                            {slides.map((_, i) => (
                                <div key={i} className="h-1.5 flex-1 bg-black/30 rounded-full overflow-hidden backdrop-blur-sm">
                                    <div 
                                        className={`h-full bg-white shadow-[0_0_15px_rgba(255,255,255,0.8)] transition-all ease-linear ${currentSlide === i ? 'w-full duration-[3000ms]' : currentSlide > i ? 'w-full' : 'w-0'}`}
                                    />
                                </div>
                            ))}
                        </div>

                        {/* 2. CENTER CONTENT (Fade & Slide) */}
                        <div className="relative h-72">
                            {slides.map((s, i) => (
                                <div 
                                    key={i}
                                    className={`absolute inset-0 transition-all duration-700 ease-out transform ${currentSlide === i ? 'translate-x-0 opacity-100' : 'translate-x-12 opacity-0 pointer-events-none'}`}
                                >
                                    <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-xl border border-white/20 px-5 py-2.5 rounded-2xl text-white text-[11px] font-black uppercase tracking-[0.2em] mb-8 shadow-2xl">
                                        <span className="text-red-300">{s.icon}</span>
                                        {s.badge}
                                    </div>
                                    
                                    <h2 className="text-6xl font-black text-white leading-tight mb-6 tracking-tighter drop-shadow-2xl">
                                        {s.title}
                                    </h2>
                                    <p className="text-white/80 text-xl font-medium max-w-lg leading-relaxed drop-shadow-md">
                                        {s.description}
                                    </p>
                                </div>
                            ))}
                        </div>

                        {/* 3. BOTTOM NAVIGATION & FEATURES */}
                        <div className="flex items-end justify-between">
                            {/* Feature Chips */}
                            <div className="flex gap-3">
                                {[<FiHeart />, <FiTrendingUp />, <FiShield />].map((icon, idx) => (
                                    <div key={idx} className="w-12 h-12 flex items-center justify-center bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 text-white/90 hover:bg-white hover:text-[#B01030] transition-all cursor-help">
                                        {icon}
                                    </div>
                                ))}
                            </div>

                            {/* Manual Slide Controls */}
                            <div className="flex gap-4">
                                <button 
                                    onClick={prevSlide}
                                    className="w-14 h-14 rounded-2xl border border-white/20 flex items-center justify-center text-white hover:bg-white hover:text-[#B01030] transition-all backdrop-blur-sm active:scale-90"
                                >
                                    <FiChevronLeft size={24} />
                                </button>
                                <button 
                                    onClick={nextSlide}
                                    className="w-14 h-14 rounded-2xl border border-white/20 flex items-center justify-center text-white hover:bg-white hover:text-[#B01030] transition-all backdrop-blur-sm active:scale-90"
                                >
                                    <FiChevronRight size={24} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Aesthetic Floating Card Mockup */}
                    <div className="absolute top-[40%] right-[-5%] w-72 p-6 bg-white/10 backdrop-blur-2xl border border-white/20 rounded-[2.5rem] shadow-2xl rotate-[-6deg] opacity-40 group-hover/carousel:rotate-0 group-hover/carousel:opacity-100 transition-all duration-700">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-red-400 rounded-full"></div>
                            <div className="space-y-2">
                                <div className="w-20 h-2 bg-white/40 rounded"></div>
                                <div className="w-12 h-2 bg-white/20 rounded"></div>
                            </div>
                        </div>
                        <div className="w-full h-24 bg-white/10 rounded-2xl"></div>
                    </div>
                </div>

            </div>
        </div>
    );
}