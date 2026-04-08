import Link from "next/link";
import Image from "next/image";
import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.page}>
      <div className={styles.bgLeft} />
      <div className={styles.bgRight} />

      <section className={styles.container}>
        {/* HERO */}
        <section className={styles.hero}>
          <div className={styles.logoPanel}>
            <Image
              src="/logo-enfokus-white.png"
              alt="Enfokus"
              width={420}
              height={180}
              priority
              className={styles.logo}
            />
          </div>

          <div className={styles.heroText}>
            <span className={styles.kicker}>Ambiente interno</span>

            <h1 className={styles.title}>
              Plataforma interna Enfokus
            </h1>

            <p className={styles.subtitle}>
              Acesse rapidamente os sistemas da Enfokus Contabilidade e
              Finanças Corporativas em um único ambiente, com navegação simples
              e visual corporativo.
            </p>
          </div>
        </section>

        {/* CARDS */}
        <section className={styles.grid}>
          <Link href="/auditor_fiscal" className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.cardIcon}>📊</div>
              <div className={styles.cardChip}>Sistema</div>
            </div>

            <h2 className={styles.cardTitle}>Auditor Fiscal</h2>

            <p className={styles.cardText}>
              Ambiente para auditoria e análise tributária, com foco em leitura,
              conferência e revisão fiscal.
            </p>

            <div className={styles.cardFooter}>
              <span className={styles.cardAction}>Abrir sistema</span>
              <span className={styles.cardArrow}>→</span>
            </div>
          </Link>

          <Link href="/validador_entradas" className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.cardIcon}>📥</div>
              <div className={styles.cardChip}>Sistema</div>
            </div>

            <h2 className={styles.cardTitle}>Validador de Entradas</h2>

            <p className={styles.cardText}>
              Ferramenta para conferência fiscal de entradas, identificação de
              alertas e validação das notas.
            </p>

            <div className={styles.cardFooter}>
              <span className={styles.cardAction}>Abrir sistema</span>
              <span className={styles.cardArrow}>→</span>
            </div>
          </Link>
        </section>
      </section>
    </main>
  );
}