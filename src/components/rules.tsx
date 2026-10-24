import { Link } from "@tanstack/react-router"
import { CLEAR_BONUS, MAX_STRIKES } from "@/lib/game"
import { providerCount } from "@/lib/cast"
import { FREEZES } from "@/lib/streak"

export function Rules() {
  const items: Array<[string, React.ReactNode]> = [
    ["Jak se hraje?", "Píšete odpovědi na otázku dne. Když odpověď patří mezi osm nejčastějších, otočí se na tabuli. Hra končí, když najdete všech osm, nebo po páté chybě."],
    ["Kolik mám pokusů?", `Chyby jsou ${MAX_STRIKES}. Správných tipů můžete dát kolik chcete. Zopakovaný tip ani odpověď, která už na tabuli je, se za chybu nepočítá.`],
    ["Jak se počítají body?", `Odpověď má 10 bodů za každou umělou inteligenci, která ji řekla. Čím výš na tabuli, tím víc bodů. Za celou tabuli je ${CLEAR_BONUS} bodů navíc.`],
    ["Jaké jsou nápovědy?", "Klepněte na skrytou odpověď. Odkrýt písmeno můžete až třikrát, každé ubere čtvrtinu bodů za tu odpověď, takže uhodnutá odpověď s nápovědou pořád stojí za to. Nápověda Kdo to řekl je zdarma: prozradí, jaké postavy odpověď daly, třeba že hlavně důchodci z Moravy."],
    ["Musím psát přesně?", "Ne. Odpovědi jsou vždy jedno slovo. Velká písmena a diakritika nevadí, drobné překlepy ani záměna i a y také ne. Uznáváme i jiné tvary a blízká synonyma, která jsme připravili předem."],
    ["Kdo odpovídá?", `Sto jazykových modelů od ${providerCount} firem, od malých po největší. Každý hraje jinou českou postavu s věkem, bydlištěm a povoláním, aby odpovědi nebyly všechny stejné.`],
    ["Kdy je nová otázka?", "Každý den o půlnoci českého času. Otázka je pro všechny stejná a tabule je připravená dopředu, nikdo ji během dne nemění."],
    [
      "Můžu hrát starší dny?",
      <>
        Ano, v <Link to="/archiv" className="underline underline-offset-4">archivu</Link>. Do série dnů se ale počítá jen hra odehraná v den, kdy otázka vyšla.
      </>,
    ],
    [
      "Co je série a zmrazení?",
      `Série počítá dny, kdy jste dohráli tabuli v den, kdy vyšla. Když jeden nebo dva dny po sobě vynecháte, série nepadne: hlídají ji ${FREEZES} zmrazení, která se po každé odehrané hře zase doplní. Až třetí vynechaný den po sobě sérii ukončí.`,
    ],
    [
      "Ukládáte o mně něco?",
      "Když začnete hrát, založíme vám hostovský účet. Ukládáme k němu vaše hry, tipy a výsledky, aby se nic neztratilo a abyste viděli, jak hráli ostatní. S e-mailem a heslem se z hosta stane trvalý účet, který máte na každém zařízení. Chybné tipy čteme jen proto, abychom hru naučili další synonyma.",
    ],
    ["Proč umělá inteligence, a ne lidé?", "Protože je zajímavé vidět, co si stroje myslí o Češích. Někdy trefí hospodu a knedlíky přesně, jindy se spletou tak, že se tomu člověk zasměje."],
    ["Odkud je ten vzhled?", "Z klapkových tabulí Pragotron, které roky ukazovaly odjezdy a příjezdy na českých nádražích, a ze státní modré a červené."],
  ]

  return (
    <section id="pravidla" className="bg-ground text-foreground">
      <div className="page grid gap-8 py-24 md:grid-cols-12 md:gap-6 md:py-40">
        <h2 className="head reveal md:col-span-3">Pravidla</h2>
        <div className="md:col-span-8 md:col-start-5 md:columns-2 md:gap-14">
          {items.map(([question, answer], i) => (
            <p key={question} className="reveal mb-5 break-inside-avoid leading-[1.55]" style={{ "--d": `${60 + (i % 5) * 60}ms` } as React.CSSProperties}>
              <span className="font-semibold">{question}</span> {answer}
            </p>
          ))}
        </div>
      </div>
    </section>
  )
}
