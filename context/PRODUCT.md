# Product Context

## What

Pipeline reklamowy video służący **produktowi Filipa: go2ev**. Filip to znajomy Michała — to nieformalna współpraca, nie usługa.

## Stakeholders

- **Approver w pętli:** Filip (klika "Approve & Publish" w mailach)
- **Hoster + płatnik infra:** Michał (trackuje koszty do nieformalnego rozliczenia z Filipem)
- **Audience:** klienci marketingowi go2ev na YouTube Shorts

## Cadence

- Placeholder: 2x/tydzień (Mon, Thu 10:00) — **do potwierdzenia z Filipem**
- Projekt obecnie **pre-launch** — szykujemy infrastrukturę, nie produkujemy jeszcze regularnie

## Extensibility

Filip wspomniał że może chcieć użyć tego pod inną spółkę w przyszłości. Architektura powinna to dopuszczać bez over-engineering: unikać hardcode'ów `go2ev-*`, preferować config-driven.

## Out of scope w tym projekcie

- Performance reeli / KPIs / ROI — nie tu
- Editorial strategy / wybór tematów — Filip i Michał ustalają poza systemem (źródła w Google Doc)
- Cennik / sales — nieformalne rozliczenie z Filipem
