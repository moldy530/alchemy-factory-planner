import { ChevronDown, Search, X } from "lucide-react";
import { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/utils";

interface Option {
    value: string;
    label: string;
}

interface SearchableSelectProps {
    options: Option[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string; // Class for the trigger button
    dropdownClassName?: string; // Class for the dropdown container
}

export function SearchableSelect({
    options,
    value,
    onChange,
    placeholder = "Select...",
    className,
    dropdownClassName,
}: SearchableSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);


    useEffect(() => {
        if (isOpen && optionRefs.current[highlightedIndex]) {
            optionRefs.current[highlightedIndex]?.scrollIntoView({
                block: "nearest",
            });
        }
    }, [highlightedIndex, isOpen]);

    const selectedOption = options.find((opt) => opt.value === value);

    // Filter options
    const filteredOptions = options.filter((opt) =>
        opt.label.toLowerCase().includes(search.toLowerCase())
    );

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(event.target as Node) &&
                (!dropdownRef.current || !dropdownRef.current.contains(event.target as Node))
            ) {
                setIsOpen(false);
                setSearch("");
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    useEffect(() => {
        if (isOpen && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [isOpen]);

    const [dropdownStyles, setDropdownStyles] = useState<{ top: number; left: number; width: number } | null>(null);

    const handleOpenChange = (open: boolean) => {
        if (open && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();

            setDropdownStyles({
                top: rect.bottom + window.scrollY + 4, // +4 for slight gap
                left: rect.left + window.scrollX,
                width: rect.width
            });
        }

        setIsOpen(open);
        setHighlightedIndex(0);
        if (!open) {
            // Short timeout to allow click to process if needed, or just reset immediately
            setSearch("");
            setDropdownStyles(null);
        }
    };

    // Close on scroll/resize to prevent floating detached dropdowns
    useEffect(() => {
        if (!isOpen) return;

        const handleScroll = (e: Event) => {
            // If scrolling happens inside the dropdown, don't close
            if (dropdownRef.current && dropdownRef.current.contains(e.target as Node)) {
                return;
            }
            handleOpenChange(false);
        };

        window.addEventListener("scroll", handleScroll, true); // Capture phase to catch all scrolls
        window.addEventListener("resize", handleScroll);

        return () => {
            window.removeEventListener("scroll", handleScroll, true);
            window.removeEventListener("resize", handleScroll);
        }
    }, [isOpen]);

    return (
        <div className="relative" ref={containerRef}>
            {/* Trigger Button */}
            <button
                type="button" // Prevent form submission if inside a form
                onClick={() => {
                    handleOpenChange(!isOpen);
                }}
                className={cn(
                    "flex items-center justify-between w-full text-left px-2 py-1 rounded border border-transparent transition-colors outline-none cursor-pointer",
                    "hover:bg-[var(--surface-elevated)]/50 focus:border-[var(--accent-gold)]/50",
                    className
                )}
            >
                <span className="truncate block">
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <ChevronDown size={14} className="opacity-50 ml-2 flex-shrink-0" />
            </button>

            {/* Dropdown Menu - Rendered in Portal */}
            {isOpen && dropdownStyles && createPortal(
                <div
                    ref={dropdownRef}
                    style={{
                        top: dropdownStyles.top,
                        left: dropdownStyles.left,
                        width: dropdownStyles.width
                    }}
                    className={cn(
                        "fixed z-[9999] bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-xl overflow-hidden flex flex-col max-h-[250px]",
                        dropdownClassName
                    )}
                >
                    {/* Search Input */}
                    <div className="p-2 border-b border-[var(--border-subtle)] flex items-center gap-2 bg-[var(--surface)] sticky top-0">
                        <Search size={12} className="text-[var(--text-muted)]" />
                        <input
                            ref={searchInputRef}
                            type="text"
                            className="bg-transparent w-full text-xs text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
                            placeholder="Search..."
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setHighlightedIndex(0);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "ArrowDown") {
                                    e.preventDefault();
                                    setHighlightedIndex((prev) =>
                                        prev < filteredOptions.length - 1 ? prev + 1 : 0
                                    );
                                } else if (e.key === "ArrowUp") {
                                    e.preventDefault();
                                    setHighlightedIndex((prev) =>
                                        prev > 0 ? prev - 1 : filteredOptions.length - 1
                                    );
                                } else if (e.key === "Enter" && filteredOptions.length > 0) {
                                    e.preventDefault();
                                    onChange(filteredOptions[highlightedIndex].value);
                                    handleOpenChange(false);
                                } else if (e.key === "Escape") {
                                    e.preventDefault();
                                    handleOpenChange(false);
                                }
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                        />
                        {search && (
                            <button
                                onClick={() => {
                                    setSearch("");
                                    setHighlightedIndex(0);
                                }}
                                className="text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>

                    {/* Options List */}
                    <div className="overflow-y-auto custom-scrollbar flex-1 p-1">
                        {filteredOptions.length === 0 ? (
                            <div className="text-[10px] text-[var(--text-muted)] text-center py-2">
                                No matches found
                            </div>
                        ) : (
                            filteredOptions.map((opt, index) => (
                                <button
                                    key={opt.value}
                                    ref={(el) => { optionRefs.current[index] = el; }}
                                    onMouseDown={(e) => {
                                        e.preventDefault(); // Prevent focus loss
                                        onChange(opt.value);
                                        handleOpenChange(false);
                                    }}
                                    onMouseEnter={() => setHighlightedIndex(index)}
                                    className={cn(
                                        "w-full text-left px-2 py-1.5 text-xs rounded hover:bg-[var(--surface-elevated)] transition-colors block truncate",
                                        opt.value === value
                                            ? "text-[var(--accent-gold)] bg-[var(--accent-gold)]/10"
                                            : index === highlightedIndex
                                                ? "bg-[var(--surface-elevated)] text-[var(--text-primary)]"
                                                : "text-[var(--text-secondary)]"
                                    )}
                                >
                                    {opt.label}
                                </button>
                            ))
                        )}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
