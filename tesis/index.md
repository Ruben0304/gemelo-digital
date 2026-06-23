---
title: "Gemelo digital para una microrred fotovoltaica aislada"
subtitle: "Trabajo de diploma para optar por el título de Ingeniero Informático"
author:
  - Rubén Hernández Acevedo
  - Fabián Fernández Gálvez
tutors:
  - "Dr. C. Nayma Cepero Pérez"
  - "MSc. Ernesto Alberto Álvarez"
institution: "Universidad Tecnológica de La Habana \"José Antonio Echeverría\" (CUJAE)"
faculty: "Facultad de Ingeniería Informática"
career: "Ingeniería Informática"
city: "La Habana, Cuba"
month: "junio"
date: "2026"
lang: "es"
documentclass: report
classoption:
  - 12pt
  - twoside
  - openany
papersize: letter
geometry:
  - top=2.5cm
  - bottom=2.5cm
  - left=3cm
  - right=2.5cm
linestretch: 1.5
fontsize: 12pt
mainfont: "Arial"
sansfont: "Arial"
monofont: "Menlo"
# Norma CUJAE / estándar tesis ingeniería Cuba:
# Arial 12, interlineado 1.5, texto justificado (default LaTeX),
# márgenes 3cm izq / 2.5cm sup, inf, der.
bibliography: referencias.bib
csl: ieee.csl
link-citations: true
# Índices (TOC/LOF/LOT) desactivados aquí: se colocan manualmente al final del
# front matter (extras/simbolos.md) para que el índice quede DESPUÉS de
# declaración, agradecimientos, resumen y listas (norma CUJAE).
toc: false
lof: false
lot: false
numbersections: true
header-includes: |
  \usepackage{siunitx}
  \usepackage{booktabs}
  \usepackage{float}
  \floatplacement{figure}{H}
  \usepackage{csquotes}
  \usepackage{enumitem}
  \usepackage{graphicx}
  \usepackage{textcomp}
  \usepackage{longtable}
  \hyphenpenalty=10000
  \exhyphenpenalty=10000
  \emergencystretch=3em
  \usepackage{etoolbox}
  \raggedbottom
  \setlength{\LTpre}{6pt}
  \setlength{\LTpost}{10pt}
  \setlength{\intextsep}{8pt plus 1pt minus 1pt}
  \setlength{\textfloatsep}{8pt plus 1pt minus 1pt}
  \setlength{\abovecaptionskip}{4pt}
  \setlength{\belowcaptionskip}{2pt}
  \AtBeginEnvironment{longtable}{\small\setlength{\tabcolsep}{4pt}\hyphenpenalty=150\exhyphenpenalty=150\renewcommand{\_}{\textunderscore\allowbreak}}
  \AtBeginDocument{\renewcommand{\tablename}{Tabla}\renewcommand{\listtablename}{Índice de tablas}}
  \let\maketitle\relax
  \pagestyle{plain}
  \makeatletter
  \renewcommand{\@makechapterhead}[1]{%
    \vspace*{-58pt}{\parindent\z@\raggedright\normalfont
      \ifnum\c@secnumdepth>\m@ne\huge\bfseries\@chapapp\space\thechapter\par\nobreak\vskip 16\p@\fi
      \interlinepenalty\@M\Huge\bfseries #1\par\nobreak\vskip 26\p@}}
  \renewcommand{\@makeschapterhead}[1]{%
    \vspace*{-58pt}{\parindent\z@\raggedright\normalfont
      \interlinepenalty\@M\Huge\bfseries #1\par\nobreak\vskip 26\p@}}
  \renewcommand\section{\@startsection{section}{1}{\z@}{-2.4ex}{1.0ex}{\normalfont\Large\bfseries\raggedright}}
  \renewcommand\subsection{\@startsection{subsection}{2}{\z@}{-2.0ex}{0.8ex}{\normalfont\large\bfseries\raggedright}}
  \renewcommand\subsubsection{\@startsection{subsubsection}{3}{\z@}{-1.8ex}{0.6ex}{\normalfont\normalsize\bfseries\raggedright}}
  \makeatother
---

<!--
  ARCHIVO PRINCIPAL DE LA TESIS — solo metadatos pandoc.

  El ORDEN DE COMPILACIÓN definitivo vive en COMMANDS.md.
  No duplicar la lista aquí: si añades un .md nuevo, edita COMMANDS.md
  (regla documentada en README.md, sección "Agregar un Nuevo Subcapítulo").

  La portada CUJAE se inyecta con --include-before-body=extras/portada.tex
  (LaTeX puro; pandoc no genera el layout exigido por la norma).
-->
