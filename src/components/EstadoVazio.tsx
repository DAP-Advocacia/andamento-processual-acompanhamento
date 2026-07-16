import { Center, Stack, Text, Title } from '@mantine/core'
import type { ReactNode } from 'react'

interface EstadoVazioProps {
  titulo: string
  descricao?: string
  acao?: ReactNode
}

export function EstadoVazio({ titulo, descricao, acao }: EstadoVazioProps) {
  return (
    <Center mih={280}>
      <Stack align="center" gap="xs">
        <Title order={3} ta="center">
          {titulo}
        </Title>
        {descricao && (
          <Text c="dimmed" ta="center" maw={440}>
            {descricao}
          </Text>
        )}
        {acao}
      </Stack>
    </Center>
  )
}
