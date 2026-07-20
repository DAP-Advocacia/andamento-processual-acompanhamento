import { Center, Stack, Text, Title } from '@mantine/core'
import type { ReactNode } from 'react'
import classes from './EstadoVazio.module.css'

interface EstadoVazioProps {
  titulo: string
  descricao?: string
  acao?: ReactNode
}

export function EstadoVazio({ titulo, descricao, acao }: EstadoVazioProps) {
  return (
    <Center mih={280}>
      <Stack align="center" gap="xs">
        <Title order={3} ta="center" className={classes.titulo}>
          {titulo}
        </Title>
        {descricao && (
          <Text ta="center" maw={440} className={classes.descricao}>
            {descricao}
          </Text>
        )}
        {acao}
      </Stack>
    </Center>
  )
}
