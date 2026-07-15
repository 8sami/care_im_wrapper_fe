import CareIcon from "@/CAREUI/icons/CareIcon";

import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

import { useTranslation } from "@/hooks/useTranslation";

export interface RecipientOption {
  id: string;
  label: string;
  sublabel?: string;
}

interface RecipientPickerProps {
  placeholder: string;
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
  options: RecipientOption[];
  isSearching: boolean;
  selected: RecipientOption[];
  onSelect: (option: RecipientOption) => void;
  onRemove: (id: string) => void;
}

// A plain multi-select search, trimmed down from care_fe's
// debounced-search-in-a-Command idiom (ResourceCategoryPicker).
export default function RecipientPicker({
  placeholder,
  searchTerm,
  onSearchTermChange,
  options,
  isSearching,
  selected,
  onSelect,
  onRemove,
}: RecipientPickerProps) {
  const { t } = useTranslation();
  const selectedIds = new Set(selected.map((s) => s.id));
  const availableOptions = options.filter((o) => !selectedIds.has(o.id));

  return (
    <div className="space-y-2">
      <Command
        shouldFilter={false}
        className="overflow-hidden rounded-md border border-gray-300 focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500 divide-gray-300"
      >
        <CommandInput
          placeholder={placeholder}
          value={searchTerm}
          onValueChange={onSearchTermChange}
          className="border-0 shadow-none outline-hidden focus:border-0 focus:shadow-none focus:ring-0"
        />
        <CommandList>
          {isSearching ? (
            <div className="cursor-default p-4 text-sm text-gray-500">
              {t("searching")}
            </div>
          ) : searchTerm.length < 2 ? (
            <div className="cursor-default p-4 text-sm text-gray-500">
              {t("start_typing_to_search")}
            </div>
          ) : availableOptions.length === 0 ? (
            <CommandEmpty>{t("no_matches_found")}</CommandEmpty>
          ) : (
            <CommandGroup>
              {availableOptions.map((option) => (
                <CommandItem
                  key={option.id}
                  value={option.id}
                  onSelect={() => onSelect(option)}
                >
                  <div className="cursor-pointer flex flex-col">
                    <span className="text-sm">{option.label}</span>
                    {option.sublabel && (
                      <span className="text-xs text-gray-500">
                        {option.sublabel}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((option) => (
            <Badge key={option.id} variant="secondary" className="gap-1">
              {option.label}
              <button
                type="button"
                onClick={() => onRemove(option.id)}
                aria-label={t("remove")}
              >
                <CareIcon icon="l-times" className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
